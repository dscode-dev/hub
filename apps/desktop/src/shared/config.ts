import { app } from 'electron';
import { join } from 'node:path';

/**
 * Configuracao unica do runtime desktop.
 *
 * Todo path e porta passa por aqui. Nenhum outro modulo monta caminho absoluto
 * ou concatena URL da API por conta propria - e o que mantem dev e app empacotado
 * funcionando com o mesmo codigo.
 */

export const IS_DEV = !app.isPackaged;

/** Esquema proprio para servir o export estatico do Next em producao. */
export const APP_SCHEME = 'hub';
export const APP_ORIGIN = `${APP_SCHEME}://app`;

/**
 * Porta preferida do backend local. E so uma preferencia: se estiver ocupada,
 * `resolveBackendPort` escolhe outra livre. Porta fixa faria o app se recusar a
 * abrir em qualquer maquina onde algo ja use a 3001 - e o usuario nao tem como
 * saber que precisa liberar uma porta.
 */
export const PREFERRED_BACKEND_PORT = Number(process.env.HUB_BACKEND_PORT ?? 3001);

/** Loopback explicito: o backend do PDV nao deve escutar na rede local. */
export const BACKEND_HOST = '127.0.0.1';

/**
 * Porta efetivamente em uso. Definida uma unica vez no boot, antes da CSP e do
 * spawn do backend, porque ambos derivam a origem dela.
 */
let backendPort = PREFERRED_BACKEND_PORT;

export function setBackendPort(port: number): void {
  backendPort = port;
}

export function getBackendPort(): number {
  return backendPort;
}

export function backendOrigin(): string {
  return `http://${BACKEND_HOST}:${backendPort}`;
}

export function backendApiBase(): string {
  return `${backendOrigin()}/api/v1`;
}

export function backendHealthUrl(): string {
  return `${backendApiBase()}/health`;
}

export const DEV_RENDERER_URL = process.env.HUB_DEV_RENDERER_URL ?? 'http://localhost:3000';

/**
 * De onde vem a UI.
 *
 * Escolha explicita, e nao inferida de `app.isPackaged`: rodar o Electron sem
 * empacotar e o fluxo normal de validacao do export estatico, e nesse caso o
 * dev server do Next nem esta no ar. Apenas `npm run dev:desktop` liga
 * HUB_DEV_SERVER=1 e passa a carregar o dev server com HMR.
 */
export const USE_DEV_SERVER = process.env.HUB_DEV_SERVER === '1';

/** Origens autorizadas a ocupar a janela principal. */
export const ALLOWED_ORIGINS = USE_DEV_SERVER ? [DEV_RENDERER_URL, APP_ORIGIN] : [APP_ORIGIN];

export interface AppPaths {
  /** Diretorio com o export estatico do Next (`out/`). */
  rendererDir: string;
  /** Diretorio do build do NestJS (contem `main.js`). */
  backendDir: string;
  /** Raiz do workspace do backend, usada como cwd do processo filho. */
  backendCwd: string;
  /** HTML locais do Electron (splash, erro). */
  windowsDir: string;
  assetsDir: string;
}

/**
 * Resolve os paths dos tres artefatos.
 *
 * Em desenvolvimento eles vivem no source tree; empacotado, ficam em
 * `process.resourcesPath` (declarados como extraResources no electron-builder).
 */
export function resolvePaths(): AppPaths {
  if (IS_DEV) {
    // __dirname = apps/desktop/dist/main
    const desktopRoot = join(__dirname, '..', '..');
    const repoRoot = join(desktopRoot, '..', '..');

    return {
      rendererDir: join(repoRoot, 'apps', 'web', 'out'),
      backendDir: join(repoRoot, 'apps', 'api', 'dist'),
      backendCwd: join(repoRoot, 'apps', 'api'),
      windowsDir: join(desktopRoot, 'dist', 'windows'),
      assetsDir: join(desktopRoot, 'assets'),
    };
  }

  const resources = process.resourcesPath;

  return {
    rendererDir: join(resources, 'renderer'),
    backendDir: join(resources, 'backend', 'dist'),
    backendCwd: join(resources, 'backend'),
    windowsDir: join(app.getAppPath(), 'dist', 'windows'),
    assetsDir: join(resources, 'assets'),
  };
}

/** Tempo maximo de espera pelo health check do backend. */
export const BACKEND_READY_TIMEOUT_MS = Number(process.env.HUB_BACKEND_TIMEOUT_MS ?? 45_000);
export const BACKEND_POLL_INTERVAL_MS = 350;

/** Prazo para o backend sair sozinho antes do kill forcado. */
export const BACKEND_SHUTDOWN_GRACE_MS = 5_000;
