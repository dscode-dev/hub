import { getSessionDriver } from './session-driver';

/**
 * Guarda do access token.
 *
 * Vive apenas em memoria do renderer - nunca em localStorage, sessionStorage
 * ou cookie. Ao fechar a janela ele desaparece; a continuidade da sessao vem
 * do refresh token, que fica no processo principal.
 */

let accessToken: string | null = null;
/** Renovacoes concorrentes compartilham a mesma chamada. */
let refreshInFlight: Promise<string | null> | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken(): void {
  accessToken = null;
}

/** Avisa a aplicacao quando a sessao acaba de vez (refresh recusado). */
export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

/**
 * Renova o access token.
 *
 * Varias requisicoes podem receber 401 ao mesmo tempo; todas aguardam a mesma
 * renovacao para nao disparar rotacoes concorrentes do refresh token, o que
 * invalidaria a sessao no backend.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = getSessionDriver()
    .refresh()
    .then((result) => {
      if (!result.ok || !result.accessToken) {
        accessToken = null;
        onSessionLost?.();
        return null;
      }

      accessToken = result.accessToken;
      return accessToken;
    })
    .catch(() => {
      accessToken = null;
      onSessionLost?.();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}
