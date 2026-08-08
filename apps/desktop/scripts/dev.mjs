import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'node:fs';

/**
 * Runner de desenvolvimento do Electron.
 *
 * Recompila Main/Preload e reinicia o Electron quando eles mudam. Renderer e
 * backend tem watch proprio (HMR do Next e `nest start --watch`), entao nada
 * aqui interfere neles.
 */
const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, '..');

let electron = null;
let rebuilding = false;
let pending = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: desktopRoot, stdio: 'inherit', shell: true, ...options });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} saiu com ${code}`))));
    child.on('error', reject);
  });
}

async function build() {
  await run('npm', ['run', 'dev:build']);
}

function startElectron() {
  electron = spawn('npx', ['electron', '.'], {
    cwd: desktopRoot,
    stdio: 'inherit',
    shell: true,
    // Sinaliza ao Main Process para carregar o dev server do Next (HMR).
    env: { ...process.env, NODE_ENV: 'development', HUB_DEV_SERVER: '1' },
  });

  electron.on('exit', (code) => {
    // Saida espontanea do Electron encerra o watcher junto.
    if (!rebuilding) {
      process.exit(code ?? 0);
    }
  });
}

function stopElectron() {
  return new Promise((resolve) => {
    if (!electron || electron.exitCode !== null) {
      resolve();
      return;
    }

    electron.once('exit', () => resolve());
    electron.kill('SIGTERM');
  });
}

async function restart() {
  if (rebuilding) {
    pending = true;
    return;
  }

  rebuilding = true;

  try {
    await stopElectron();
    await build();
    startElectron();
  } catch (error) {
    process.stderr.write(`Falha ao recompilar: ${error.message}\n`);
  } finally {
    rebuilding = false;

    if (pending) {
      pending = false;
      void restart();
    }
  }
}

await build();
startElectron();

let debounce = null;
watch(join(desktopRoot, 'src'), { recursive: true }, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => void restart(), 150);
});

process.stdout.write('Observando apps/desktop/src para reiniciar o Electron\n');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void stopElectron().then(() => process.exit(0));
  });
}
