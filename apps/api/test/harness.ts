import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import type { UserRole } from '@hub/shared';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { API_PREFIX } from '@/common/constants';
import { configureApp } from '@/configure-app';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

/** Sobe a aplicacao completa (guards, pipes e filtros globais inclusos). */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  // Mesma configuracao do bootstrap real: prefixo, pipes e limites de corpo.
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/**
 * Limpa o banco entre testes.
 *
 * SQLite nao tem TRUNCATE: usamos DELETE na ordem inversa das dependencias,
 * com as chaves estrangeiras ativas - assim um erro de ordem apareceria aqui
 * em vez de mascarar um problema de modelagem.
 */
const TABLES_IN_DELETE_ORDER = [
  'inventory_count_items',
  'inventory_counts',
  'inventory_movements',
  'inventory_balances',
  'import_jobs',
  'audit_logs',
  'products',
  'categories',
  'refresh_tokens',
  'users',
  'organizations',
  'instance_setup',
];

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  for (const table of TABLES_IN_DELETE_ORDER) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

export interface SeededTenant {
  organizationId: string;
  userId: string;
  email: string;
  password: string;
}

let tenantCounter = 0;

export async function seedTenant(
  prisma: PrismaService,
  options: { name?: string; role?: UserRole; active?: boolean } = {},
): Promise<SeededTenant> {
  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}`;
  const password = 'Hub@123456';

  const organization = await prisma.organization.create({
    data: { name: options.name ?? `Empresa ${suffix}` },
  });

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'Usuario de teste',
      email: `user-${suffix}@teste.local`,
      passwordHash: await hash(password, 4),
      role: options.role ?? 'OWNER',
      active: options.active ?? true,
    },
  });

  return {
    organizationId: organization.id,
    userId: user.id,
    email: user.email,
    password,
  };
}

export const apiPath = (path: string): string => `/${API_PREFIX}${path}`;
