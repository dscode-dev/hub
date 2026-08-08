import { contextBridge, ipcRenderer } from 'electron';
import type {
  BackendStatus,
  DesktopSessionResult,
  HardwareActionResult,
  HardwareDevice,
  HardwareStatus,
  HubBridge,
  ReceiptPayload,
  ScaleReading,
  ScanEvent,
} from '@hub/shared';
import { CHANNELS } from '../ipc/channels';

/**
 * Preload: unica superficie de contato entre o Renderer e o Main Process.
 *
 * Regras que este arquivo faz cumprir:
 *
 *  - nenhuma funcao aceita nome de canal como argumento; o mapeamento
 *    capability -> canal fica fechado aqui dentro;
 *  - nada de `ipcRenderer` cru atravessa o contextBridge;
 *  - o objeto exposto e congelado, para o renderer nao conseguir sobrescrever
 *    um metodo e enganar codigo que confie em `window.hub`.
 *
 * Roda com `sandbox: true`, por isso e empacotado pelo esbuild num arquivo
 * unico: preloads em sandbox nao conseguem resolver `require` relativo.
 */

/** A URL da API chega por `additionalArguments`, disponivel de forma sincrona. */
function readApiBase(): string {
  const prefix = '--hub-api-base=';
  const argument = process.argv.find((value) => value.startsWith(prefix));

  return argument ? argument.slice(prefix.length) : 'http://127.0.0.1:3001/api/v1';
}

const bridge: HubBridge = {
  isDesktop: true,

  app: {
    getVersion: () => ipcRenderer.invoke(CHANNELS.app.getVersion) as Promise<string>,
    getPlatform: () =>
      ipcRenderer.invoke(CHANNELS.app.getPlatform) as Promise<'darwin' | 'win32' | 'linux'>,
  },

  backend: {
    baseUrl: readApiBase(),
    getStatus: () => ipcRenderer.invoke(CHANNELS.backend.getStatus) as Promise<BackendStatus>,
    restart: () => ipcRenderer.invoke(CHANNELS.backend.restart) as Promise<BackendStatus>,
  },

  session: {
    login: (credentials) =>
      ipcRenderer.invoke(CHANNELS.session.login, {
        // Copia explicita: nao repassamos o objeto do renderer direto ao IPC.
        email: String(credentials.email ?? ''),
        password: String(credentials.password ?? ''),
      }) as Promise<DesktopSessionResult>,
    refresh: () => ipcRenderer.invoke(CHANNELS.session.refresh) as Promise<DesktopSessionResult>,
    logout: () => ipcRenderer.invoke(CHANNELS.session.logout) as Promise<void>,
    hasStoredSession: () => ipcRenderer.invoke(CHANNELS.session.hasStored) as Promise<boolean>,
  },

  hardware: {
    printer: {
      getStatus: () =>
        ipcRenderer.invoke(CHANNELS.hardware.printer.getStatus) as Promise<HardwareStatus>,
      printReceipt: (payload: ReceiptPayload) =>
        ipcRenderer.invoke(
          CHANNELS.hardware.printer.printReceipt,
          serializeReceipt(payload),
        ) as Promise<HardwareActionResult>,
      openCashDrawer: () =>
        ipcRenderer.invoke(
          CHANNELS.hardware.printer.openCashDrawer,
        ) as Promise<HardwareActionResult>,
    },

    scanner: {
      getStatus: () =>
        ipcRenderer.invoke(CHANNELS.hardware.scanner.getStatus) as Promise<HardwareStatus>,
      getDevices: () =>
        ipcRenderer.invoke(CHANNELS.hardware.scanner.getDevices) as Promise<HardwareDevice[]>,
      startListening: () =>
        ipcRenderer.invoke(
          CHANNELS.hardware.scanner.startListening,
        ) as Promise<HardwareActionResult>,
      stopListening: () =>
        ipcRenderer.invoke(
          CHANNELS.hardware.scanner.stopListening,
        ) as Promise<HardwareActionResult>,
      onScan: (listener: (event: ScanEvent) => void) => {
        /*
         * O listener do renderer nunca recebe o `IpcRendererEvent`: repassar o
         * evento daria acesso ao `sender` e, por ele, ao restante do IPC.
         */
        const handler = (_event: unknown, payload: ScanEvent) => listener(payload);
        ipcRenderer.on(CHANNELS.hardware.scanner.onScan, handler);

        return () => {
          ipcRenderer.removeListener(CHANNELS.hardware.scanner.onScan, handler);
        };
      },
    },

    scale: {
      getStatus: () =>
        ipcRenderer.invoke(CHANNELS.hardware.scale.getStatus) as Promise<HardwareStatus>,
      getDevices: () =>
        ipcRenderer.invoke(CHANNELS.hardware.scale.getDevices) as Promise<HardwareDevice[]>,
      read: () => ipcRenderer.invoke(CHANNELS.hardware.scale.read) as Promise<ScaleReading>,
    },
  },

  system: {
    openExternal: (url: string) =>
      ipcRenderer.invoke(CHANNELS.system.openExternal, String(url)) as Promise<boolean>,
  },
};

/** Serializa em objeto simples: estruturas do renderer nao cruzam o bridge. */
function serializeReceipt(payload: ReceiptPayload): ReceiptPayload {
  return {
    title: String(payload.title ?? ''),
    cut: payload.cut === true,
    lines: (payload.lines ?? []).map((line) => ({
      text: String(line.text ?? ''),
      align: line.align ?? 'left',
      bold: line.bold === true,
      size: line.size ?? 'normal',
    })),
  };
}

contextBridge.exposeInMainWorld('hub', Object.freeze(bridge));
