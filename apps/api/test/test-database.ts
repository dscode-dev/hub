import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Banco usado pelos testes de integracao.
 *
 * O diretorio tem espaco no nome de proposito: e exatamente o formato do
 * caminho real em producao ("Application Support/Plataforma Hub"). Testar so
 * com `./dev.db` esconderia erros de montagem e encoding da DATABASE_URL.
 */
export const TEST_ROOT = join(tmpdir(), 'Plataforma Hub Test');
export const TEST_DATA_DIR = join(TEST_ROOT, 'data');
export const TEST_DATABASE_FILE = join(TEST_DATA_DIR, 'hub.db');

/** Mesma construcao usada pelo Electron: caminho literal, sem encoding. */
export function buildTestDatabaseUrl(databasePath = TEST_DATABASE_FILE): string {
  return `file:${databasePath.replace(/\\/g, '/')}`;
}

export function prepareTestDirectory(): void {
  mkdirSync(TEST_DATA_DIR, { recursive: true });
}

/** Remove o banco inteiro, inclusive os arquivos auxiliares do WAL. */
export function removeTestDatabase(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${TEST_DATABASE_FILE}${suffix}`, { force: true });
  }
}
