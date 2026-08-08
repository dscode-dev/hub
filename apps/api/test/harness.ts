import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import type { UserRole } from '@hub/shared';
import { AppModule } from '@/app.module';
import { buildValidationPipe } from '@/common/pipes/validation.pipe';
import { PrismaService } from '@/common/prisma/prisma.service';
import { API_PREFIX } from '@/common/constants';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

/** Sobe a aplicacao completa (guards, pipes e filtros globais inclusos). */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(buildValidationPipe());
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/** Limpa o banco entre testes respeitando a ordem das FKs. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "import_jobs", "audit_logs", "products", "categories", "refresh_tokens", "users", "organizations" RESTART IDENTITY CASCADE',
  );
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
