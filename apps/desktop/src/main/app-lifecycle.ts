import { app, BrowserWindow } from 'electron';
import { bindScannerEvents } from '../ipc/register-ipc';
import { closeLogger, createLogger } from '../shared/logger';
import { IS_DEV } from '../shared/config';
import { onBackendRestored, onUnexpectedBackendExit, startBackend, stopBackend } from './backend-process';
import { registerAppProtocolHandler } from './protocol';
import { createErrorWindow, createMainWindow, createSplashWindow } from './window';

const log = createLogger('lifecycle');

/**
 * Orquestracao do ciclo de vida.
 *
 * Sequencia de boot:
 *   splash -> backend -> health OK -> janela principal -> splash fecha
 *
 * A UI so aparece depois do backend responder. Abrir a janela em paralelo com o
 * spawn produziria uma tela de erro momentanea a cada inicializacao.
 */

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let errorWindow: BrowserWindow | null = null;
let unbindScanner: (() => void) | null = null;

/** Encerramento so pode acontecer uma vez, mesmo com varios gatilhos. */
let shuttingDown = false;
/** `before-quit` precisa segurar o quit ate o backend morrer. */
let backendReleased = false;

export async function bootstrap(): Promise<void> {
  registerAppProtocolHandler();

  splashWindow = createSplashWindow();

  try {
    await startBackend();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showStartupFailure(detail);
    return;
  }

  openMainWindow();
}

function openMainWindow(): void {
  mainWindow = createMainWindow();
  unbindScanner = bindScannerEvents(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    closeSplash();
  });

  mainWindow.on('closed', () => {
    unbindScanner?.();
    unbindScanner = null;
    mainWindow = null;
  });
}

function closeSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
  }

  splashWindow = null;
}

function showStartupFailure(detail: string): void {
  log.error('Falha na inicializacao', detail);
  closeSplash();

  if (errorWindow && !errorWindow.isDestroyed()) {
    errorWindow.focus();
    return;
  }

  errorWindow = createErrorWindow(detail);
  errorWindow.on('closed', () => {
    errorWindow = null;
  });
}

/** Foca a janela existente quando uma segunda instancia e aberta. */
export function focusExistingWindow(): void {
  const target = mainWindow ?? errorWindow ?? splashWindow;

  if (!target || target.isDestroyed()) {
    return;
  }

  if (target.isMinimized()) {
    target.restore();
  }

  target.focus();
  log.info('Segunda instancia redirecionada para a janela existente');
}

export function registerLifecycleHandlers(): void {
  /*
   * O backend precisa morrer antes do app sair. `before-quit` e sincrono, entao
   * cancelamos o primeiro quit, encerramos o backend e chamamos quit de novo.
   */
  app.on('before-quit', (event) => {
    if (backendReleased) {
      return;
    }

    event.preventDefault();

    void shutdown().finally(() => {
      backendReleased = true;
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    // No macOS o padrao e manter o app vivo, mas um PDV nao se beneficia disso.
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !shuttingDown) {
      openMainWindow();
    }
  });

  // Rede de seguranca: cobre SIGINT/SIGTERM no terminal durante o dev.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown().finally(() => app.exit(0));
    });
  }

  /*
   * Retry disparado pela tela de erro: se o backend voltou, fechamos o aviso e
   * abrimos a aplicacao de verdade, sem obrigar o usuario a reabrir o programa.
   */
  onBackendRestored(() => {
    if (shuttingDown || mainWindow) {
      return;
    }

    if (errorWindow && !errorWindow.isDestroyed()) {
      errorWindow.destroy();
      errorWindow = null;
    }

    openMainWindow();
  });

  onUnexpectedBackendExit((detail) => {
    if (shuttingDown) {
      return;
    }

    // Backend caiu com o app aberto: a UI viraria erro de rede em toda acao.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
      mainWindow = null;
    }

    showStartupFailure(detail);
  });

  if (IS_DEV) {
    log.info('Executando em modo desenvolvimento');
  }
}

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log.info('Encerrando aplicacao');

  unbindScanner?.();
  unbindScanner = null;

  await stopBackend();
  closeLogger();
}
