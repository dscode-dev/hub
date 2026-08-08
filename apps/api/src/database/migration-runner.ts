import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Aplicacao de migrations no boot.
 *
 * Por que um runner proprio em vez de chamar `prisma migrate deploy`: o CLI do
 * Prisma e devDependency e nao vai para o aplicativo instalado. Empacotar o CLI
 * inteiro so para rodar migrations custaria dezenas de MB.
 *
 * O runner le exatamente os mesmos arquivos que `prisma migrate dev` gera e
 * escreve na mesma tabela `_prisma_migrations`, com o mesmo formato de
 * checksum. Isso mantem `prisma migrate status` util no desenvolvimento e
 * garante que dev e producao apliquem o MESMO SQL - nada de `db push` aqui.
 */

const MIGRATIONS_TABLE = '_prisma_migrations';

export class MigrationError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'MigrationError';
  }
}

export interface MigrationResult {
  applied: string[];
  alreadyApplied: number;
}

function migrationsDirectory(): string {
  // dist/database -> ../../prisma/migrations (mesmo layout no backend empacotado)
  return resolve(__dirname, '..', '..', 'prisma', 'migrations');
}

/**
 * Divide o arquivo em statements.
 *
 * Migrations geradas pelo Prisma para SQLite sao DDL simples (CREATE TABLE,
 * CREATE INDEX, PRAGMA), sem corpo de trigger - por isso separar em `;` e
 * seguro aqui. Se um dia uma migration precisar de trigger ou BEGIN...END,
 * este ponto precisa evoluir junto; o teste de migrations sinalizaria.
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => stripComments(statement).trim())
    .filter((statement) => statement.length > 0);
}

function stripComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

async function ensureMigrationsTable(prisma: PrismaClient): Promise<void> {
  // Mesma estrutura criada pelo Prisma, para interoperar com o CLI.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);
}

/**
 * Aplica todas as migrations pendentes, em ordem.
 *
 * Roda antes de a aplicacao aceitar requisicoes. Qualquer falha aborta o boot:
 * atender com o schema errado corromperia dados de forma silenciosa.
 */
export async function runMigrations(prisma: PrismaClient): Promise<MigrationResult> {
  const logger = new Logger('MigrationRunner');
  const directory = migrationsDirectory();

  if (!existsSync(directory)) {
    throw new MigrationError(`Diretorio de migrations nao encontrado em ${directory}`);
  }

  await ensureMigrationsTable(prisma);

  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "${MIGRATIONS_TABLE}" WHERE finished_at IS NOT NULL`,
  );
  const appliedNames = new Set(applied.map((row) => row.migration_name));

  const available = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // Nomes tem prefixo de timestamp: ordem alfabetica = ordem cronologica.
    .sort();

  const pending = available.filter((name) => !appliedNames.has(name));

  if (pending.length === 0) {
    logger.log(`Banco atualizado (${appliedNames.size} migrations aplicadas)`);
    return { applied: [], alreadyApplied: appliedNames.size };
  }

  logger.log(`Aplicando ${pending.length} migration(s) pendente(s)`);

  for (const name of pending) {
    const file = join(directory, name, 'migration.sql');

    if (!existsSync(file)) {
      throw new MigrationError(`Migration ${name} nao possui migration.sql`);
    }

    const sql = readFileSync(file, 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const statements = splitStatements(sql);

    try {
      /*
       * Cada migration e uma transacao: ou o schema avanca por inteiro, ou o
       * banco permanece exatamente como estava. O registro em
       * `_prisma_migrations` entra na mesma transacao, entao nao existe estado
       * "aplicada pela metade".
       */
      await prisma.$transaction(async (tx) => {
        for (const statement of statements) {
          await tx.$executeRawUnsafe(statement);
        }

        await tx.$executeRawUnsafe(
          `INSERT INTO "${MIGRATIONS_TABLE}"
             ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
           VALUES (?, ?, current_timestamp, ?, current_timestamp, ?)`,
          randomUUID(),
          checksum,
          name,
          statements.length,
        );
      });

      logger.log(`Migration aplicada: ${name}`);
    } catch (error) {
      throw new MigrationError(`Falha ao aplicar a migration ${name}`, error);
    }
  }

  return { applied: pending, alreadyApplied: appliedNames.size };
}
