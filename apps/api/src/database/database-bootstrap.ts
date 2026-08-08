import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ensureDatabaseDirectory, resolveDatabaseFile } from './database-paths';
import { runMigrations } from './migration-runner';

/**
 * Preparacao do banco antes de a aplicacao subir.
 *
 * Ordem obrigatoria:
 *   diretorio -> banco criado/aberto -> migrations -> Nest aceita requisicoes
 *
 * Roda com um PrismaClient proprio e descartavel, encerrado ao final: as
 * migrations precisam acontecer antes de qualquer modulo do Nest tocar no
 * banco, e nao queremos deixar uma segunda conexao viva depois disso.
 *
 * Qualquer falha aqui deve derrubar o processo. O Electron ja trata a saida do
 * backend mostrando a tela de erro, e subir com schema desatualizado
 * corromperia dados silenciosamente.
 */
export async function prepareDatabase(): Promise<void> {
  const logger = new Logger('DatabaseBootstrap');

  const databaseFile = resolveDatabaseFile(process.env.DATABASE_URL);
  const directory = ensureDatabaseDirectory(databaseFile);

  // Loga o diretorio, nunca a URL completa: ela pode carregar o nome do usuario.
  logger.log(`Diretorio de dados pronto: ${directory}`);

  const prisma = new PrismaClient();

  try {
    /*
     * O SQLite cria o arquivo na primeira conexao, entao nao ha passo separado
     * de "criar banco": conectar ja resolve a primeira execucao.
     */
    await prisma.$connect();

    // Chave estrangeira precisa estar ligada tambem durante as migrations.
    // queryRaw: PRAGMAs podem devolver o valor aplicado como linha.
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');

    logger.log('Migrations iniciadas');
    const result = await runMigrations(prisma);

    if (result.applied.length > 0) {
      logger.log(`Migrations concluidas: ${result.applied.join(', ')}`);
    } else {
      logger.log('Migrations concluidas: nada pendente');
    }
  } finally {
    await prisma.$disconnect();
  }
}
