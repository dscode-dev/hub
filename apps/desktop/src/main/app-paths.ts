import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Diretorios de dados da instalacao.
 *
 * Regra que sustenta atualizacao segura: **aplicativo e dados sao coisas
 * diferentes**. O `.app`/`.exe` pode ser substituido por uma versao nova a
 * qualquer momento; nada aqui pode viver dentro dele.
 *
 *   macOS   ~/Library/Application Support/Plataforma Hub/
 *   Windows %APPDATA%\Plataforma Hub\
 *   Linux   ~/.config/Plataforma Hub/
 *
 *   Plataforma Hub/
 *   ├── data/     hub.db (banco operacional)
 *   ├── backups/  copias geradas pelo backend
 *   └── logs/     desktop.log
 *
 * `app.getPath('userData')` ja resolve o diretorio correto por sistema
 * operacional, incluindo o nome do produto - por isso nunca montamos esse
 * caminho a mao.
 */

export function getUserDataPath(): string {
  return app.getPath('userData');
}

export function getDatabaseDirectory(): string {
  return ensureDirectory(join(getUserDataPath(), 'data'));
}

export function getDatabasePath(): string {
  return join(getDatabaseDirectory(), 'hub.db');
}

export function getBackupDirectory(): string {
  return ensureDirectory(join(getUserDataPath(), 'backups'));
}

export function getLogDirectory(): string {
  return ensureDirectory(join(getUserDataPath(), 'logs'));
}

/**
 * Monta a DATABASE_URL do Prisma para SQLite.
 *
 * O caminho vai LITERAL, sem percent-encoding. Verificado na pratica: o
 * conector SQLite do Prisma trata o que vem depois de `file:` como caminho de
 * arquivo, nao como URL - codificar os espacos de "Plataforma Hub" faz o
 * Prisma procurar um diretorio chamado "Plataforma%20Hub" e falhar ao abrir.
 *
 * No Windows as barras invertidas viram barras normais (`file:C:/...`),
 * formato aceito nas tres plataformas.
 */
export function buildDatabaseUrl(databasePath: string): string {
  return `file:${databasePath.replace(/\\/g, '/')}`;
}

function ensureDirectory(directory: string): string {
  mkdirSync(directory, { recursive: true });
  return directory;
}
