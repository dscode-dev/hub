import { prepareTestDirectory, removeTestDatabases } from './test-database';

/**
 * Limpa o diretorio de bancos antes da execucao.
 *
 * Nao migra nada aqui: cada arquivo de teste recebe o proprio banco e o boot da
 * aplicacao aplica as migrations com o MESMO runner de producao - e nao com
 * `prisma db push`. Se as migrations quebrarem, os testes quebram junto, que e
 * exatamente o sinal que queremos antes de um build chegar ao cliente.
 */
export default function globalSetup(): void {
  removeTestDatabases();
  prepareTestDirectory();
}
