import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Monta um backend autocontido para o empacotamento.
 *
 * Por que isto e necessario: npm workspaces faz hoisting das dependencias para
 * o node_modules da raiz, entao `apps/api/node_modules` praticamente nao existe.
 * Apontar o electron-builder para la produziria um app instalado sem NestJS nem
 * Prisma - ou seja, um backend que nunca sobe na maquina do cliente.
 *
 * Aqui geramos `apps/desktop/build/backend` com dist + prisma + apenas as
 * dependencias de producao, e e essa pasta que vai para dentro do pacote.
 */
const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, '..');
const repoRoot = join(desktopRoot, '..', '..');
const apiRoot = join(repoRoot, 'apps', 'api');
const stageDir = join(desktopRoot, 'build', 'backend');

const apiPkg = JSON.parse(readFileSync(join(apiRoot, 'package.json'), 'utf-8'));
const rootPkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));

if (!existsSync(join(apiRoot, 'dist', 'main.js'))) {
  throw new Error('Build do backend nao encontrado. Rode `npm run build:api` antes.');
}

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

cpSync(join(apiRoot, 'dist'), join(stageDir, 'dist'), { recursive: true });
cpSync(join(apiRoot, 'prisma'), join(stageDir, 'prisma'), { recursive: true });

/*
 * `@hub/shared` e workspace: no pacote final ele nao existe como registro npm,
 * entao copiamos o build dele para dentro do node_modules do backend.
 */
const sharedDist = join(repoRoot, 'packages', 'shared', 'dist');

if (!existsSync(sharedDist)) {
  throw new Error('Build de @hub/shared nao encontrado. Rode `npm run build:shared` antes.');
}

const dependencies = { ...apiPkg.dependencies };
delete dependencies['@hub/shared'];

writeFileSync(
  join(stageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'hub-backend',
      version: apiPkg.version,
      private: true,
      main: 'dist/main.js',
      dependencies,
      // npm 11 bloqueia install scripts por padrao; o Prisma precisa do dele
      // para posicionar os engines nativos.
      allowScripts: rootPkg.allowScripts ?? {},
    },
    null,
    2,
  )}\n`,
);

process.stdout.write('Instalando dependencias de producao do backend...\n');
execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts=false'], {
  cwd: stageDir,
  stdio: 'inherit',
});

// Copiado depois do install para nao ser removido pela arvore do npm.
const sharedTarget = join(stageDir, 'node_modules', '@hub', 'shared');
mkdirSync(sharedTarget, { recursive: true });
cpSync(sharedDist, join(sharedTarget, 'dist'), { recursive: true });
writeFileSync(
  join(sharedTarget, 'package.json'),
  `${JSON.stringify(
    { name: '@hub/shared', version: '0.1.0', main: './dist/index.js', types: './dist/index.d.ts' },
    null,
    2,
  )}\n`,
);

/*
 * Prisma Client.
 *
 * Gerar dentro da staging area nao funciona: o CLI do Prisma e devDependency e
 * nao consegue resolver o @prisma/client daquela arvore isolada. Como o client
 * gerado no workspace ja corresponde a este mesmo schema, geramos la (caminho
 * conhecido e testado) e copiamos o resultado - inclusive os engines nativos.
 */
process.stdout.write('Gerando Prisma Client no workspace...\n');
const prismaCli = join(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');

if (!existsSync(prismaCli)) {
  throw new Error(`CLI do Prisma nao encontrado em ${prismaCli}`);
}

execFileSync(process.execPath, [prismaCli, 'generate'], { cwd: apiRoot, stdio: 'inherit' });

const generatedClient = join(repoRoot, 'node_modules', '.prisma');

if (!existsSync(join(generatedClient, 'client'))) {
  throw new Error('Prisma Client gerado nao encontrado no workspace.');
}

process.stdout.write('Copiando Prisma Client para o backend empacotado...\n');
cpSync(generatedClient, join(stageDir, 'node_modules', '.prisma'), { recursive: true });

process.stdout.write(`Backend preparado em ${stageDir}\n`);
