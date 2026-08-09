import { shell, type BrowserWindow, type Session } from 'electron';
import { ALLOWED_ORIGINS, backendOrigin, DEV_RENDERER_URL, USE_DEV_SERVER } from '../shared/config';
import { createLogger } from '../shared/logger';

const log = createLogger('security');

/** Protocolos que podem sair para o navegador do sistema. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Politica de seguranca da janela.
 *
 * Regra geral: a janela principal so pode exibir o proprio renderer. Qualquer
 * outro destino ou vira `shell.openExternal` (se for http/https) ou e negado.
 * Sem isso, um link malicioso poderia substituir a UI do PDV por uma pagina
 * externa mantendo o preload no contexto.
 */
export function applyWindowSecurity(window: BrowserWindow): void {
  const { webContents } = window;

  webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfAllowed(url);
    // Nenhuma janela filha e criada pelo conteudo: PDV nao abre popup.
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) {
      return;
    }

    event.preventDefault();
    log.warn('Navegacao externa bloqueada na janela principal', url);
    openExternalIfAllowed(url);
  });

  // Redirecionamento tambem e navegacao: cobre o caso de uma resposta 30x.
  webContents.on('will-redirect', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      log.warn('Redirecionamento externo bloqueado', url);
    }
  });

  webContents.on('will-attach-webview', (event) => {
    // Nao usamos <webview>; permitir seria ampliar a superficie a toa.
    event.preventDefault();
    log.warn('Tentativa de anexar webview bloqueada');
  });
}

/**
 * CSP aplicada por header em toda resposta do renderer.
 *
 * `connect-src` precisa do backend em loopback. Em dev tambem liberamos o
 * dev server do Next e seu websocket de HMR - nada disso vale em producao.
 */
export function applyContentSecurityPolicy(session: Session): void {
  const devConnect = USE_DEV_SERVER ? ` ${DEV_RENDERER_URL} ws://localhost:* http://localhost:*` : '';
  // Next injeta estilos inline; sem 'unsafe-inline' em style-src a UI quebra.
  // 'unsafe-eval' fica de fora: so o React Refresh do dev precisaria dele.
  const devScript = USE_DEV_SERVER ? " 'unsafe-eval'" : '';

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devScript}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${backendOrigin()}${devConnect}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');

  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });

  /*
   * O app e local: camera, microfone, geolocalizacao e afins nao sao usados.
   * Negar por padrao evita que um bug no renderer consiga pedir permissao.
   */
  session.setPermissionRequestHandler((_webContents, permission, callback) => {
    log.warn('Permissao negada', permission);
    callback(false);
  });

  session.setPermissionCheckHandler(() => false);
}

function isInternalUrl(url: string): boolean {
  try {
    const { origin } = new URL(url);
    return ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

/** Ponto unico de saida para o navegador do sistema. */
export function openExternalIfAllowed(url: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    log.warn('URL externa invalida ignorada', url);
    return false;
  }

  if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
    log.warn('Protocolo externo nao permitido', parsed.protocol);
    return false;
  }

  void shell.openExternal(parsed.toString());
  return true;
}
