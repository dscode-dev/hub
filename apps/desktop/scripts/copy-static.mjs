import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copia os arquivos que o esbuild nao processa (HTML das janelas nativas e a
 * logo usada por elas) para dentro de `dist/`.
 *
 * Splash e tela de erro precisam da logo no mesmo diretorio porque sao
 * carregadas via `loadFile`, e portanto resolvem `src="logo-hub.png"`
 * relativo ao proprio HTML.
 */
const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, '..');

const windowsSrc = join(desktopRoot, 'src', 'windows');
const windowsDest = join(desktopRoot, 'dist', 'windows');

mkdirSync(windowsDest, { recursive: true });
cpSync(windowsSrc, windowsDest, { recursive: true });
cpSync(join(desktopRoot, 'assets', 'logo-hub.png'), join(windowsDest, 'logo-hub.png'));

process.stdout.write(`Janelas nativas copiadas para ${windowsDest}\n`);
