import { mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Banco usado pelos testes de integracao.
 *
 * O diretorio tem espaco no nome de proposito: e exatamente o formato do
 * caminho real em producao ("Application Support/Plataforma Hub"). Testar so
 * com `./dev.db` esconderia erros de montagem e encoding da DATABASE_URL.
 *
 * Cada arquivo de teste recebe o PROPRIO banco, criado do zero pelo mesmo
 * runner de migrations da aplicacao. Com um arquivo unico compartilhado, o
 * `DELETE FROM` do `beforeEach` de uma suite concorria com conexoes ainda
 * abertas de outra e derrubava testes sem relacao entre si: um login falhando
 * por 401, um PATCH achando 404 num produto criado no instante anterior.
 *
 * Nao ha template copiado de proposito. Copiar so o `.db` deixaria para tras o
 * `-wal` com os commits mais recentes, e o arquivo resultante seria um banco
 * parcialmente escrito - justamente o tipo de inconsistencia que se quer evitar
 * aqui.
 */
export const TEST_ROOT = join(tmpdir(), 'Plataforma Hub Test');
export const TEST_DATA_DIR = join(TEST_ROOT, 'data');
/** Mesma construcao usada pelo Electron: caminho literal, sem encoding. */
export function buildTestDatabaseUrl(databasePath: string): string {
  return `file:${databasePath.replace(/\\/g, '/')}`;
}

export function prepareTestDirectory(): void {
  mkdirSync(TEST_DATA_DIR, { recursive: true });
}

/** Remove tudo: cada execucao comeca do zero, inclusive o template. */
export function removeTestDatabases(): void {
  rmSync(TEST_ROOT, { recursive: true, force: true });
}

/**
 * Reserva o caminho do banco desta suite e devolve a DATABASE_URL.
 *
 * O arquivo ainda nao existe: quem o cria e o boot da aplicacao, rodando as
 * migrations de verdade. Isso mantem o ganho do global-setup original - testar
 * tambem o caminho de primeira execucao - agora em toda suite.
 */
export function createSuiteDatabase(): string {
  prepareTestDirectory();

  return buildTestDatabaseUrl(join(TEST_DATA_DIR, `hub-${randomUUID()}.db`));
}
