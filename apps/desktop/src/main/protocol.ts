import { net, protocol } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP_SCHEME, resolvePaths } from '../shared/config';
import { createLogger } from '../shared/logger';

const log = createLogger('protocol');

/**
 * Servidor estatico interno para o export do Next.
 *
 * Por que um esquema proprio em vez de `file://` direto:
 *
 *  1. `file://` nao resolve index de diretorio, entao dar refresh em
 *     /products quebraria - e navegacao com refresh e requisito.
 *  2. `file://` tem origem `null`, o que obrigaria o CORS do backend a aceitar
 *     `null` ou `*`. Com `hub://app` a origem e estavel e liberada nominalmente.
 *  3. Um esquema registrado como `standard` + `secure` habilita CSP, fetch e
 *     History API com o mesmo comportamento de producao web.
 *
 * O conteudo continua sendo lido do disco local: nao existe servidor HTTP aqui.
 */

/** Precisa rodar antes de `app.whenReady()`. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

/** Precisa rodar depois de `app.whenReady()`. */
export function registerAppProtocolHandler(): void {
  const { rendererDir } = resolvePaths();

  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveRequestPath(rendererDir, request.url);

    if (!filePath) {
      log.warn('Requisicao fora do diretorio do renderer foi bloqueada', request.url);
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });

  log.info('Protocolo do renderer registrado', { scheme: APP_SCHEME, rendererDir });
}

/**
 * Traduz `hub://app/products/detail?id=1` em um arquivo dentro de `out/`.
 * Cai para `index.html` quando a rota nao tem arquivo proprio, preservando o
 * roteamento client-side do Next.
 */
function resolveRequestPath(rendererDir: string, requestUrl: string): string | null {
  const { pathname } = new URL(requestUrl);
  const decoded = decodeURIComponent(pathname);

  const candidates =
    decoded === '/' || decoded === ''
      ? ['index.html']
      : [
          decoded.replace(/^\//, ''),
          `${decoded.replace(/^\//, '').replace(/\/$/, '')}.html`,
          join(decoded.replace(/^\//, ''), 'index.html'),
        ];

  for (const candidate of candidates) {
    const resolved = safeJoin(rendererDir, candidate);

    if (resolved && existsSync(resolved) && statSync(resolved).isFile()) {
      return resolved;
    }
  }

  // Rota conhecida apenas pelo router do Next (ex.: apos History API).
  const fallback = join(rendererDir, 'index.html');
  return existsSync(fallback) ? fallback : null;
}

/** Impede path traversal (`../`) para fora do diretorio publicado. */
function safeJoin(root: string, candidate: string): string | null {
  const target = normalize(join(root, candidate));
  const rel = relative(root, target);

  if (rel.startsWith('..') || rel.startsWith(`${sep}..`)) {
    return null;
  }

  return target;
}
