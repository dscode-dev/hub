import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

/**
 * Traducao entre a DATABASE_URL do Prisma e o caminho real do arquivo.
 *
 * O Electron injeta uma URL absoluta apontando para o diretorio de dados do
 * usuario; em desenvolvimento a URL e relativa ao diretorio do schema. Os dois
 * casos precisam resolver para o mesmo lugar que o Prisma vai abrir, senao o
 * runner de migrations e o backup atuariam sobre arquivos diferentes.
 */

const SCHEMA_DIR = resolve(__dirname, '..', '..', 'prisma');

export class DatabasePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabasePathError';
  }
}

/**
 * Extrai o caminho do arquivo a partir da URL `file:...`.
 *
 * Aceita `file:/abs/path`, `file:///abs/path` e `file:./relativo`.
 *
 * O caminho NAO e decodificado: o Prisma tambem nao codifica ao abrir o
 * arquivo, entao decodificar aqui faria o backup e as migrations atuarem sobre
 * um caminho diferente do que o Prisma realmente usa.
 */
export function resolveDatabaseFile(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new DatabasePathError('DATABASE_URL nao foi definida.');
  }

  if (!databaseUrl.startsWith('file:')) {
    throw new DatabasePathError(
      'A instalacao desktop usa SQLite: DATABASE_URL deve comecar com "file:".',
    );
  }

  const raw = databaseUrl.slice('file:'.length);
  // `file://host/path` nao e usado pelo Prisma, mas toleramos as barras extras.
  const withoutSlashes = raw.startsWith('//') ? raw.slice(2) : raw;
  const decoded = withoutSlashes;

  if (!decoded) {
    throw new DatabasePathError('DATABASE_URL nao aponta para nenhum arquivo.');
  }

  // Relativa: o Prisma resolve a partir do diretorio do schema, nao do cwd.
  return isAbsolute(decoded) ? decoded : resolve(SCHEMA_DIR, decoded);
}

/**
 * Garante que o diretorio do banco existe e e gravavel.
 * Falhar aqui e melhor do que falhar no meio da primeira escrita.
 */
export function ensureDatabaseDirectory(databaseFile: string): string {
  const directory = dirname(databaseFile);

  try {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
  } catch (error) {
    throw new DatabasePathError(
      `Nao foi possivel criar o diretorio do banco em ${directory}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return directory;
}
