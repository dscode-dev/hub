import type { HubBridge } from '@hub/shared';

/**
 * Porta de entrada unica para a ponte do Electron.
 *
 * Nenhum outro arquivo deve testar `window.hub` diretamente: concentrar aqui
 * mantem a base rodando tambem no navegador (dev) e evita que a checagem de
 * ambiente vaze para dentro de componentes.
 */

export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.hub?.isDesktop === true;
}

/** Ponte quando estamos no desktop; `null` no navegador. */
export function getBridge(): HubBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.hub ?? null;
}

/**
 * Ponte obrigatoria. Use apenas em caminhos que so existem no desktop -
 * o erro sinaliza bug de programacao, nao condicao esperada.
 */
export function requireBridge(): HubBridge {
  const bridge = getBridge();

  if (!bridge) {
    throw new Error('Esta funcionalidade so esta disponivel no aplicativo desktop.');
  }

  return bridge;
}
