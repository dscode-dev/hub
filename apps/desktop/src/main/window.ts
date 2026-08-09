import { BrowserWindow, nativeImage } from 'electron';
import { join } from 'node:path';
import {
  APP_ORIGIN,
  backendApiBase,
  DEV_RENDERER_URL,
  USE_DEV_SERVER,
  resolvePaths,
} from '../shared/config';
import { createLogger } from '../shared/logger';
import { applyWindowSecurity } from './security';

const log = createLogger('window');

const PRELOAD_PATH = join(__dirname, '..', 'preload', 'preload.js');

/**
 * Configuracao de seguranca compartilhada por toda janela da aplicacao.
 * Nenhuma janela recebe Node no renderer, em nenhuma circunstancia.
 */
const SECURE_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webviewTag: false,
  // Sem isso, o renderer poderia carregar http:// dentro de uma pagina segura.
  allowRunningInsecureContent: false,
} as const;

export function getAppIcon(): Electron.NativeImage | undefined {
  const { assetsDir } = resolvePaths();
  const icon = nativeImage.createFromPath(join(assetsDir, 'icon.png'));

  return icon.isEmpty() ? undefined : icon;
}

/**
 * Splash exibida enquanto o NestJS sobe.
 *
 * Existe para que o cliente nunca veja tela branca: o backend pode levar
 * alguns segundos e um PDV abrindo "vazio" passa impressao de travamento.
 */
export function createSplashWindow(): BrowserWindow {
  const { windowsDir } = resolvePaths();

  const splash = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: '#ffffff',
    icon: getAppIcon(),
    webPreferences: { ...SECURE_WEB_PREFERENCES, preload: PRELOAD_PATH },
  });

  applyWindowSecurity(splash);
  void splash.loadFile(join(windowsDir, 'splash.html'));

  splash.once('ready-to-show', () => splash.show());
  log.info('Splash criada');

  return splash;
}

/**
 * Janela principal. Fica oculta ate `ready-to-show` para nao piscar branco
 * antes do primeiro paint.
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Plataforma Hub',
    icon: getAppIcon(),
    webPreferences: {
      ...SECURE_WEB_PREFERENCES,
      preload: PRELOAD_PATH,
      /*
       * Entrega a URL da API ao preload de forma sincrona. Evita que o renderer
       * precise de um round-trip de IPC so para saber onde fica o backend.
       */
      additionalArguments: [`--hub-api-base=${backendApiBase()}`],
    },
  });

  applyWindowSecurity(window);

  const target = USE_DEV_SERVER ? DEV_RENDERER_URL : `${APP_ORIGIN}/`;
  void window.loadURL(target);

  log.info('Janela principal criada', { target });

  // DevTools no modo dev server; HUB_DEVTOOLS=1 forca em uma execucao estatica.
  if (USE_DEV_SERVER || process.env.HUB_DEVTOOLS === '1') {
    window.webContents.openDevTools({ mode: 'detach' });
  }

  return window;
}

/**
 * Janela de falha de inicializacao.
 *
 * Mostra linguagem de usuario final e oferece uma saida; o detalhe tecnico
 * vai apenas para o log.
 */
export function createErrorWindow(detail: string): BrowserWindow {
  const { windowsDir } = resolvePaths();

  const window = new BrowserWindow({
    width: 560,
    height: 380,
    resizable: false,
    center: true,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Plataforma Hub',
    icon: getAppIcon(),
    webPreferences: { ...SECURE_WEB_PREFERENCES, preload: PRELOAD_PATH },
  });

  applyWindowSecurity(window);
  void window.loadFile(join(windowsDir, 'error.html'));

  window.once('ready-to-show', () => window.show());
  log.error('Janela de erro exibida', detail);

  return window;
}
