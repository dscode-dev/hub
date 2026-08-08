import { app, session } from 'electron';
import { registerIpcHandlers } from '../ipc/register-ipc';
import { createLogger } from '../shared/logger';
import { bootstrap, focusExistingWindow, registerLifecycleHandlers } from './app-lifecycle';
import { registerAppScheme } from './protocol';
import { applyContentSecurityPolicy } from './security';

const log = createLogger('main');

/**
 * Entry point do Main Process.
 *
 * Este arquivo apenas orquestra. Janela, backend, IPC, seguranca e protocolo
 * moram em modulos proprios - o Main nao deve crescer com regra de negocio.
 */

/*
 * PDV nao pode abrir duas instancias: seriam dois backends disputando a mesma
 * porta e, no futuro, o mesmo banco local. O lock precisa vir antes de tudo.
 */
if (!app.requestSingleInstanceLock()) {
  log.warn('Outra instancia ja esta em execucao; encerrando esta');
  app.quit();
} else {
  app.on('second-instance', () => focusExistingWindow());

  // Precisa acontecer antes do app ficar pronto.
  registerAppScheme();

  app.whenReady().then(
    () => {
      log.info('Electron pronto', { version: app.getVersion(), platform: process.platform });

      applyContentSecurityPolicy(session.defaultSession);
      registerIpcHandlers();
      registerLifecycleHandlers();

      return bootstrap();
    },
    (error: unknown) => {
      log.error('Falha ao inicializar o Electron', error);
      app.quit();
    },
  );
}
