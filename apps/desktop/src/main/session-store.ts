import { app, safeStorage } from 'electron';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DesktopSessionResult } from '@hub/shared';
import { BACKEND_API_BASE } from '../shared/config';
import { createLogger } from '../shared/logger';

const log = createLogger('session');

/**
 * Cofre de sessao do desktop.
 *
 * Na versao web, o refresh token vivia num cookie HttpOnly e o browser nunca o
 * enxergava. No desktop nao existe BFF nem cookie de servidor, entao o refresh
 * token passa a morar aqui: no Main Process, cifrado em disco pelo Keychain /
 * DPAPI / libsecret via `safeStorage`.
 *
 * O renderer recebe apenas o access token de vida curta, em memoria. Nada de
 * localStorage - num balcao compartilhado isso equivaleria a deixar a sessao
 * em texto puro no disco.
 */

const TOKEN_FILE = 'session.bin';

function tokenPath(): string {
  const dir = join(app.getPath('userData'), 'secure');
  mkdirSync(dir, { recursive: true });

  return join(dir, TOKEN_FILE);
}

function persistRefreshToken(token: string): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      /*
       * Sem cofre do SO (ex.: Linux sem keyring), a sessao vale apenas enquanto
       * o app estiver aberto. Preferimos pedir login de novo a gravar em claro.
       */
      log.warn('Cofre do sistema indisponivel; sessao nao sera lembrada apos fechar');
      return;
    }

    writeFileSync(tokenPath(), safeStorage.encryptString(token), { mode: 0o600 });
  } catch (error) {
    log.error('Falha ao gravar a sessao', error);
  }
}

function readRefreshToken(): string | null {
  if (memoryRefreshToken) {
    return memoryRefreshToken;
  }

  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    const decrypted = safeStorage.decryptString(readFileSync(tokenPath()));
    memoryRefreshToken = decrypted;

    return decrypted;
  } catch {
    // Arquivo ausente na primeira execucao e o caso normal, nao um erro.
    return null;
  }
}

function clearRefreshToken(): void {
  memoryRefreshToken = null;

  try {
    rmSync(tokenPath(), { force: true });
  } catch (error) {
    log.warn('Falha ao remover a sessao gravada', error);
  }
}

/** Cache em memoria: evita descriptografar a cada refresh. */
let memoryRefreshToken: string | null = null;

interface BackendSessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function callBackend(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: BackendSessionResponse } | { ok: false; message: string }> {
  try {
    const response = await fetch(`${BACKEND_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { message?: string };
      return { ok: false, message: error.message ?? 'Nao foi possivel entrar.' };
    }

    return { ok: true, data: (await response.json()) as BackendSessionResponse };
  } catch (error) {
    log.error('Falha de comunicacao com o backend local', error);
    return { ok: false, message: 'Nao conseguimos falar com o servico local da Plataforma Hub.' };
  }
}

export async function login(credentials: {
  email: string;
  password: string;
}): Promise<DesktopSessionResult> {
  const result = await callBackend('/auth/login', credentials);

  if (!result.ok) {
    return { ok: false, accessToken: null, expiresIn: null, message: result.message };
  }

  memoryRefreshToken = result.data.refreshToken;
  persistRefreshToken(result.data.refreshToken);
  log.info('Sessao iniciada');

  return {
    ok: true,
    accessToken: result.data.accessToken,
    expiresIn: result.data.expiresIn,
  };
}

/** Rotaciona o refresh token guardado e devolve apenas o novo access token. */
export async function refresh(): Promise<DesktopSessionResult> {
  const stored = readRefreshToken();

  if (!stored) {
    return { ok: false, accessToken: null, expiresIn: null, message: 'Sessao nao encontrada.' };
  }

  const result = await callBackend('/auth/refresh', { refreshToken: stored });

  if (!result.ok) {
    clearRefreshToken();
    return { ok: false, accessToken: null, expiresIn: null, message: result.message };
  }

  memoryRefreshToken = result.data.refreshToken;
  persistRefreshToken(result.data.refreshToken);

  return {
    ok: true,
    accessToken: result.data.accessToken,
    expiresIn: result.data.expiresIn,
  };
}

export async function logout(): Promise<void> {
  const stored = readRefreshToken();

  if (stored) {
    // Revoga no backend antes de esquecer localmente.
    await callBackend('/auth/logout', { refreshToken: stored });
  }

  clearRefreshToken();
  log.info('Sessao encerrada');
}

export function hasStoredSession(): boolean {
  return readRefreshToken() !== null;
}
