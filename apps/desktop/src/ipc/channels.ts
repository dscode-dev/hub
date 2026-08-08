/**
 * Nomes de canal IPC.
 *
 * Estes identificadores sao INTERNOS ao Electron. O renderer nunca recebe um
 * canal como parametro: o preload expoe uma funcao nomeada por capability e
 * decide sozinho qual canal usar. E isso que impede o padrao
 * `invoke(channel, payload)` generico, que anularia o isolamento.
 */
export const CHANNELS = {
  app: {
    getVersion: 'app:get-version',
    getPlatform: 'app:get-platform',
  },
  backend: {
    getStatus: 'backend:get-status',
    restart: 'backend:restart',
  },
  session: {
    login: 'session:login',
    refresh: 'session:refresh',
    logout: 'session:logout',
    hasStored: 'session:has-stored',
  },
  hardware: {
    printer: {
      getStatus: 'hardware:printer:get-status',
      printReceipt: 'hardware:printer:print-receipt',
      openCashDrawer: 'hardware:printer:open-cash-drawer',
    },
    scanner: {
      getStatus: 'hardware:scanner:get-status',
      getDevices: 'hardware:scanner:get-devices',
      startListening: 'hardware:scanner:start-listening',
      stopListening: 'hardware:scanner:stop-listening',
      /** Main -> Renderer: leitura vinda de scanner serial. */
      onScan: 'hardware:scanner:scan',
    },
    scale: {
      getStatus: 'hardware:scale:get-status',
      getDevices: 'hardware:scale:get-devices',
      read: 'hardware:scale:read',
    },
  },
  system: {
    openExternal: 'system:open-external',
  },
} as const;
