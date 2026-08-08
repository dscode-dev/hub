import type { HubBridge } from '@hub/shared';

/**
 * Tipagem global da ponte exposta pelo preload do Electron.
 *
 * Opcional de proposito: a mesma base roda no navegador durante o
 * desenvolvimento, onde `window.hub` nao existe. Com isso o TypeScript obriga
 * a checagem de ambiente e nenhum componente precisa de `(window as any)`.
 */
declare global {
  interface Window {
    hub?: HubBridge;
  }
}

export {};
