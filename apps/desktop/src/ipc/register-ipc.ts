import { app, ipcMain, type BrowserWindow } from 'electron';
import type {
  BackendStatus,
  DesktopSessionResult,
  HardwareActionResult,
  HardwareDevice,
  HardwareStatus,
  ReceiptPayload,
  ScaleReading,
} from '@hub/shared';
import { getHardwareRegistry } from '../hardware/hardware.registry';
import { getBackendStatus, restartBackend } from '../main/backend-process';
import { openExternalIfAllowed } from '../main/security';
import * as sessionStore from '../main/session-store';
import { createLogger } from '../shared/logger';
import { CHANNELS } from './channels';

const log = createLogger('ipc');

/**
 * Registro dos handlers IPC.
 *
 * Todo payload vindo do renderer e tratado como nao confiavel e validado antes
 * de chegar a qualquer adapter - mesmo o renderer sendo nosso, um XSS na UI nao
 * pode virar acesso irrestrito ao processo principal.
 */
export function registerIpcHandlers(): void {
  registerApp();
  registerBackend();
  registerSession();
  registerHardware();
  registerSystem();

  log.info('Handlers IPC registrados');
}

function registerApp(): void {
  ipcMain.handle(CHANNELS.app.getVersion, (): string => app.getVersion());
  ipcMain.handle(CHANNELS.app.getPlatform, (): NodeJS.Platform => process.platform);
}

function registerBackend(): void {
  ipcMain.handle(CHANNELS.backend.getStatus, (): BackendStatus => getBackendStatus());

  ipcMain.handle(CHANNELS.backend.restart, async (): Promise<BackendStatus> => {
    log.info('Reinicio do backend solicitado pelo renderer');

    try {
      return await restartBackend();
    } catch (error) {
      log.error('Reinicio do backend falhou', error);
      return getBackendStatus();
    }
  });
}

function registerSession(): void {
  ipcMain.handle(
    CHANNELS.session.login,
    async (_event, raw: unknown): Promise<DesktopSessionResult> => {
      const credentials = parseCredentials(raw);

      if (!credentials) {
        return {
          ok: false,
          accessToken: null,
          expiresIn: null,
          message: 'Informe e-mail e senha.',
        };
      }

      return sessionStore.login(credentials);
    },
  );

  ipcMain.handle(CHANNELS.session.refresh, (): Promise<DesktopSessionResult> =>
    sessionStore.refresh(),
  );

  ipcMain.handle(CHANNELS.session.logout, (): Promise<void> => sessionStore.logout());

  ipcMain.handle(CHANNELS.session.hasStored, (): boolean => sessionStore.hasStoredSession());
}

function registerHardware(): void {
  const hardware = getHardwareRegistry();

  ipcMain.handle(
    CHANNELS.hardware.printer.getStatus,
    (): Promise<HardwareStatus> => hardware.printer.getStatus(),
  );

  ipcMain.handle(
    CHANNELS.hardware.printer.printReceipt,
    (_event, raw: unknown): Promise<HardwareActionResult> => {
      const payload = parseReceipt(raw);

      if (!payload) {
        return Promise.resolve({ ok: false, message: 'Conteudo do recibo invalido.' });
      }

      return hardware.printer.printReceipt(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.hardware.printer.openCashDrawer,
    (): Promise<HardwareActionResult> => hardware.printer.openCashDrawer(),
  );

  ipcMain.handle(
    CHANNELS.hardware.scanner.getStatus,
    (): Promise<HardwareStatus> => hardware.scanner.getStatus(),
  );

  ipcMain.handle(
    CHANNELS.hardware.scanner.getDevices,
    (): Promise<HardwareDevice[]> => hardware.scanner.getDevices(),
  );

  ipcMain.handle(
    CHANNELS.hardware.scanner.startListening,
    (): Promise<HardwareActionResult> => hardware.scanner.startListening(),
  );

  ipcMain.handle(
    CHANNELS.hardware.scanner.stopListening,
    (): Promise<HardwareActionResult> => hardware.scanner.stopListening(),
  );

  ipcMain.handle(
    CHANNELS.hardware.scale.getStatus,
    (): Promise<HardwareStatus> => hardware.scale.getStatus(),
  );

  ipcMain.handle(
    CHANNELS.hardware.scale.getDevices,
    (): Promise<HardwareDevice[]> => hardware.scale.getDevices(),
  );

  ipcMain.handle(CHANNELS.hardware.scale.read, (): Promise<ScaleReading> => hardware.scale.read());
}

function registerSystem(): void {
  ipcMain.handle(CHANNELS.system.openExternal, (_event, raw: unknown): boolean => {
    if (typeof raw !== 'string') {
      return false;
    }

    return openExternalIfAllowed(raw);
  });
}

/**
 * Encaminha leituras do scanner serial para a janela.
 * Only-forward: o renderer nunca envia neste canal, apenas escuta.
 */
export function bindScannerEvents(window: BrowserWindow): () => void {
  const hardware = getHardwareRegistry();

  return hardware.scanner.onScan((event) => {
    if (!window.isDestroyed()) {
      window.webContents.send(CHANNELS.hardware.scanner.onScan, event);
    }
  });
}

function parseCredentials(raw: unknown): { email: string; password: string } | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const { email, password } = raw as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return null;
  }

  if (!email.trim() || !password) {
    return null;
  }

  return { email: email.trim(), password };
}

function parseReceipt(raw: unknown): ReceiptPayload | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const { title, lines, cut } = raw as Record<string, unknown>;

  if (typeof title !== 'string' || !Array.isArray(lines)) {
    return null;
  }

  const parsedLines = lines.map((line) => {
    const record = (typeof line === 'object' && line !== null ? line : {}) as Record<
      string,
      unknown
    >;

    return {
      text: typeof record.text === 'string' ? record.text : '',
      align: parseAlign(record.align),
      bold: record.bold === true,
      size: record.size === 'large' ? ('large' as const) : ('normal' as const),
    };
  });

  return { title, lines: parsedLines, cut: cut === true };
}

/** Alinhamento vindo do renderer: qualquer valor fora do contrato vira 'left'. */
function parseAlign(value: unknown): 'left' | 'center' | 'right' {
  return value === 'center' || value === 'right' ? value : 'left';
}
