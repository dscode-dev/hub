import { PrismaClient } from '@prisma/client';
import { runMigrations } from '../src/database/migration-runner';
import {
  buildTestDatabaseUrl,
  prepareTestDirectory,
  removeTestDatabase,
} from './test-database';

/**
 * Prepara o banco de testes uma unica vez por execucao.
 *
 * Usa o MESMO runner de migrations da aplicacao, e nao `prisma db push`. Se as
 * migrations quebrarem, os testes quebram junto - que e exatamente o sinal que
 * queremos antes de um build chegar ao cliente.
 */
export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = buildTestDatabaseUrl();

  // Cada execucao comeca de um banco novo: testa tambem a primeira execucao.
  prepareTestDirectory();
  removeTestDatabase();

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    await runMigrations(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
