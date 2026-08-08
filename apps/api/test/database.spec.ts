import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { runMigrations } from '@/database/migration-runner';
import { resolveDatabaseFile } from '@/database/database-paths';
import { createTestApp, resetDatabase, seedTenant } from './harness';
import { TEST_DATA_DIR, buildTestDatabaseUrl } from './test-database';

/**
 * Banco local SQLite.
 *
 * Cobre o que a migracao do PostgreSQL colocou em risco: criacao do arquivo,
 * migrations, constraints, chaves estrangeiras e - o mais importante para um
 * aplicativo instalado - persistencia depois de fechar e reabrir.
 */
describe('Banco local (SQLite)', () => {
  describe('criacao e migrations', () => {
    /** Caminho proprio com espacos, como o diretorio real do usuario. */
    const freshFile = join(TEST_DATA_DIR, 'Primeira Execucao', 'hub.db');
    const freshUrl = buildTestDatabaseUrl(freshFile);

    const cleanup = () => {
      for (const suffix of ['', '-wal', '-shm']) {
        rmSync(`${freshFile}${suffix}`, { force: true });
      }
    };

    beforeEach(cleanup);
    afterAll(cleanup);

    it('cria o arquivo do banco quando ele ainda nao existe', async () => {
      const { ensureDatabaseDirectory } = await import('@/database/database-paths');
      ensureDatabaseDirectory(resolveDatabaseFile(freshUrl));

      expect(existsSync(freshFile)).toBe(false);

      const prisma = new PrismaClient({ datasources: { db: { url: freshUrl } } });

      try {
        await prisma.$connect();
        await runMigrations(prisma);
      } finally {
        await prisma.$disconnect();
      }

      expect(existsSync(freshFile)).toBe(true);
    });

    it('aplica as migrations e cria as tabelas do dominio', async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: freshUrl } } });

      try {
        await prisma.$connect();
        const result = await runMigrations(prisma);
        expect(result.applied.length).toBeGreaterThan(0);

        const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
          "SELECT name FROM sqlite_master WHERE type='table'",
        );
        const names = tables.map((row) => row.name);

        for (const table of ['organizations', 'users', 'products', 'categories', 'app_settings']) {
          expect(names).toContain(table);
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    it('e idempotente: rodar de novo nao reaplica nada', async () => {
      const prisma = new PrismaClient({ datasources: { db: { url: freshUrl } } });

      try {
        await prisma.$connect();
        const first = await runMigrations(prisma);
        const second = await runMigrations(prisma);

        expect(first.applied.length).toBeGreaterThan(0);
        // Segunda execucao (ex.: reabrir o app) nao pode tocar no schema.
        expect(second.applied).toHaveLength(0);
        expect(second.alreadyApplied).toBe(first.applied.length);
      } finally {
        await prisma.$disconnect();
      }
    });

    it('resolve o caminho do arquivo mesmo com espacos no diretorio', () => {
      const resolved = resolveDatabaseFile(freshUrl);

      expect(resolved).toBe(freshFile);
      expect(resolved).toContain('Plataforma Hub Test');
      // Nao pode haver percent-encoding: o Prisma abre o caminho literal.
      expect(resolved).not.toContain('%20');
    });
  });

  describe('integridade', () => {
    let prisma: PrismaService;
    let app: Awaited<ReturnType<typeof createTestApp>>['app'];

    beforeAll(async () => {
      ({ app, prisma } = await createTestApp());
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      await resetDatabase(prisma);
    });

    it('mantem a unique de e-mail de usuario', async () => {
      const tenant = await seedTenant(prisma);

      await expect(
        prisma.user.create({
          data: {
            organizationId: tenant.organizationId,
            name: 'Duplicado',
            email: tenant.email,
            passwordHash: 'x',
            role: 'VIEWER',
          },
        }),
      ).rejects.toThrow();
    });

    it('mantem a unique de SKU por organizacao', async () => {
      const tenant = await seedTenant(prisma);

      await prisma.product.create({
        data: { organizationId: tenant.organizationId, name: 'A', sku: 'DUP', salePriceCents: 100 },
      });

      await expect(
        prisma.product.create({
          data: {
            organizationId: tenant.organizationId,
            name: 'B',
            sku: 'DUP',
            salePriceCents: 200,
          },
        }),
      ).rejects.toThrow();
    });

    it('permite o mesmo SKU em organizacoes diferentes', async () => {
      const a = await seedTenant(prisma);
      const b = await seedTenant(prisma);

      await prisma.product.create({
        data: { organizationId: a.organizationId, name: 'A', sku: 'MESMO', salePriceCents: 100 },
      });

      await expect(
        prisma.product.create({
          data: { organizationId: b.organizationId, name: 'B', sku: 'MESMO', salePriceCents: 100 },
        }),
      ).resolves.toBeDefined();
    });

    it('aplica chave estrangeira: recusa produto de organizacao inexistente', async () => {
      // Sem PRAGMA foreign_keys=ON o SQLite aceitaria silenciosamente.
      await expect(
        prisma.product.create({
          data: {
            organizationId: 'organizacao-que-nao-existe',
            name: 'Orfao',
            salePriceCents: 100,
          },
        }),
      ).rejects.toThrow();
    });

    it('aplica cascade: remover a organizacao remove seus produtos', async () => {
      const tenant = await seedTenant(prisma);

      await prisma.product.create({
        data: { organizationId: tenant.organizationId, name: 'Produto', salePriceCents: 100 },
      });

      await prisma.organization.delete({ where: { id: tenant.organizationId } });

      expect(await prisma.product.count({ where: { organizationId: tenant.organizationId } })).toBe(
        0,
      );
    });

    it('isola dados entre organizacoes', async () => {
      const a = await seedTenant(prisma, { name: 'Alfa' });
      const b = await seedTenant(prisma, { name: 'Beta' });

      await prisma.product.create({
        data: { organizationId: a.organizationId, name: 'Produto da Alfa', salePriceCents: 100 },
      });

      const visibleToB = await prisma.product.findMany({
        where: { organizationId: b.organizationId },
      });

      expect(visibleToB).toHaveLength(0);
    });

    it('guarda dinheiro como inteiro, sem erro de ponto flutuante', async () => {
      const tenant = await seedTenant(prisma);

      // 1000 itens de R$ 19,99: em ponto flutuante a soma derivaria.
      await prisma.product.createMany({
        data: Array.from({ length: 1000 }, (_, index) => ({
          organizationId: tenant.organizationId,
          name: `Item ${index}`,
          salePriceCents: 1999,
        })),
      });

      const total = await prisma.product.aggregate({
        where: { organizationId: tenant.organizationId },
        _sum: { salePriceCents: true },
      });

      // Exato, sem tolerancia: e o ponto da decisao de armazenar em centavos.
      expect(total._sum.salePriceCents).toBe(1_999_000);
    });
  });
});
