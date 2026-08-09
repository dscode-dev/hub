import { spawn, type ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BackendStatus } from '@hub/shared';
import {
  backendApiBase,
  backendHealthUrl,
  BACKEND_HOST,
  BACKEND_POLL_INTERVAL_MS,
  getBackendPort,
  BACKEND_READY_TIMEOUT_MS,
  BACKEND_SHUTDOWN_GRACE_MS,
  resolvePaths,
} from '../shared/config';
import { createLogger } from '../shared/logger';
import { resolveBackendSecret } from './backend-secret';
import { buildDatabaseUrl, getDatabasePath } from './app-paths';

const log = createLogger('backend');

/**
 * Ciclo de vida do NestJS local.
 *
 * O usuario final nunca inicia o backend: quem faz isso e o Main Process, que
 * tambem e responsavel por garantir que nada sobre executando ao fechar o app.
 */

let child: ChildProcess | null = null;
let status: BackendStatus = { phase: 'stopped', baseUrl: backendApiBase(), detail: null };
/** Evita que o handler de exit dispare a UI de erro durante o encerramento normal. */
let stopping = false;
let startPromise: Promise<BackendStatus> | null = null;

export function getBackendStatus(): BackendStatus {
  return status;
}

export class BackendStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendStartError';
  }
}

/**
 * Inicia o backend e so resolve quando `/health` responde.
 *
 * Chamadas concorrentes compartilham a mesma promise: single instance lock
 * protege contra outra janela, isto protege contra outro caminho de codigo.
 */
export function startBackend(): Promise<BackendStatus> {
  if (startPromise) {
    return startPromise;
  }

  startPromise = bootBackend().catch((error: unknown) => {
    startPromise = null;
    throw error;
  });

  return startPromise;
}

async function bootBackend(): Promise<BackendStatus> {
  if (child && !child.killed) {
    log.info('Backend ja esta em execucao; reaproveitando processo');
    return status;
  }

  const paths = resolvePaths();
  const entry = join(paths.backendDir, 'main.js');

  if (!existsSync(entry)) {
    const message = `Build do backend nao encontrado em ${entry}`;
    log.error(message);
    status = { phase: 'failed', baseUrl: backendApiBase(), detail: message };
    throw new BackendStartError(message);
  }

  /*
   * O Renderer nunca sabe onde o banco fica, e o backend nao decide sozinho:
   * quem resolve o caminho e o Main Process, que conhece o diretorio de dados
   * do usuario. A URL vai pelo ambiente do processo filho.
   */
  const databasePath = getDatabasePath();
  const databaseUrl = buildDatabaseUrl(databasePath);

  stopping = false;
  status = { phase: 'starting', baseUrl: backendApiBase(), detail: null };
  // Loga o diretorio, nunca a URL completa: ela carrega o nome do usuario.
  log.info('Iniciando backend', { entry, port: getBackendPort(), database: 'userData/data/hub.db' });

  /*
   * spawn com o binario Node embutido no Electron (ELECTRON_RUN_AS_NODE) em vez
   * de depender de um Node instalado na maquina do cliente. `fork` nao serve
   * aqui porque criaria um canal IPC que nao usamos e complicaria o kill.
   */
  child = spawn(process.execPath, [entry], {
    cwd: paths.backendCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      PORT: String(getBackendPort()),
      HOST: BACKEND_HOST,
      // O renderer roda em hub://app; o backend precisa aceitar essa origem.
      HUB_DESKTOP: '1',
      // Permite ao backend se encerrar se o Electron morrer a forca.
      HUB_PARENT_PID: String(process.pid),
      DATABASE_URL: databaseUrl,
      // Gerado por instalacao no primeiro boot; nunca embutido no pacote.
      JWT_ACCESS_SECRET: resolveBackendSecret(),
      // O app instalado nao expoe a documentacao: ela so serve em dev.
      SWAGGER_ENABLED: process.env.SWAGGER_ENABLED ?? 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Grupo de processos proprio: permite matar a arvore inteira no POSIX.
    detached: process.platform !== 'win32',
  });

  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      log.info(`[nest] ${text}`);
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      log.warn(`[nest] ${text}`);
    }
  });

  child.on('exit', (code, signal) => {
    const wasStopping = stopping;
    child = null;
    startPromise = null;

    if (wasStopping) {
      status = { phase: 'stopped', baseUrl: backendApiBase(), detail: null };
      log.info('Backend encerrado');
      return;
    }

    const detail = `Backend encerrou inesperadamente (code=${code ?? 'null'}, signal=${signal ?? 'null'})`;
    status = { phase: 'failed', baseUrl: backendApiBase(), detail };
    log.error(detail);
    unexpectedExitHandler?.(detail);
  });

  child.on('error', (error) => {
    log.error('Falha ao iniciar o processo do backend', error);
  });

  await waitForHealth();

  status = { phase: 'ready', baseUrl: backendApiBase(), detail: null };
  log.info('Backend pronto', { url: backendApiBase() });

  return status;
}

/** Poll no /health ate responder, estourar o timeout ou o processo morrer. */
async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + BACKEND_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (!child) {
      throw new BackendStartError(
        'O backend encerrou antes de ficar disponivel. Verifique o log da aplicacao.',
      );
    }

    if (await pingHealth()) {
      return;
    }

    await delay(BACKEND_POLL_INTERVAL_MS);
  }

  throw new BackendStartError(
    `O backend nao respondeu em ${Math.round(BACKEND_READY_TIMEOUT_MS / 1000)}s.`,
  );
}

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const response = await fetch(backendHealthUrl(), { signal: controller.signal });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Encerra o backend: SIGTERM, prazo de graca e kill forcado.
 * No Windows nao existe SIGTERM real, entao `taskkill /T` cuida da arvore.
 */
export async function stopBackend(): Promise<void> {
  const current = child;

  if (!current || current.killed) {
    child = null;
    startPromise = null;
    status = { phase: 'stopped', baseUrl: backendApiBase(), detail: null };
    return;
  }

  stopping = true;
  startPromise = null;
  log.info('Encerrando backend');

  const exited = new Promise<void>((resolve) => {
    current.once('exit', () => resolve());
  });

  try {
    if (process.platform === 'win32') {
      await killWindowsTree(current.pid);
    } else if (current.pid !== undefined) {
      // Negativo = grupo de processos inteiro (habilitado por detached: true).
      process.kill(-current.pid, 'SIGTERM');
    }
  } catch (error) {
    log.warn('SIGTERM falhou; partindo para kill forcado', error);
  }

  const finished = await Promise.race([
    exited.then(() => true),
    delay(BACKEND_SHUTDOWN_GRACE_MS).then(() => false),
  ]);

  if (!finished) {
    log.warn('Backend nao encerrou no prazo; aplicando kill forcado');

    try {
      if (process.platform === 'win32') {
        await killWindowsTree(current.pid, true);
      } else if (current.pid !== undefined) {
        process.kill(-current.pid, 'SIGKILL');
      }
    } catch (error) {
      log.error('Kill forcado falhou', error);
    }

    await Promise.race([exited, delay(1_000)]);
  }

  child = null;
  status = { phase: 'stopped', baseUrl: backendApiBase(), detail: null };
}

/** No Windows, matar apenas o pid deixa netos orfaos; /T cobre a arvore. */
function killWindowsTree(pid: number | undefined, force = false): Promise<void> {
  if (pid === undefined) {
    return Promise.resolve();
  }

  const args = ['/pid', String(pid), '/T'];

  if (force) {
    args.push('/F');
  }

  return new Promise((resolve) => {
    execFile('taskkill', args, () => resolve());
  });
}

export async function restartBackend(): Promise<BackendStatus> {
  await stopBackend();
  const result = await startBackend();

  // Permite ao lifecycle reabrir a janela principal apos um retry bem-sucedido.
  restoredHandler?.();

  return result;
}

let unexpectedExitHandler: ((detail: string) => void) | null = null;
let restoredHandler: (() => void) | null = null;

/** Notifica o lifecycle quando o backend cai sozinho com o app aberto. */
export function onUnexpectedBackendExit(handler: (detail: string) => void): void {
  unexpectedExitHandler = handler;
}

/** Notifica o lifecycle quando o backend volta a ficar saudavel apos um retry. */
export function onBackendRestored(handler: () => void): void {
  restoredHandler = handler;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
