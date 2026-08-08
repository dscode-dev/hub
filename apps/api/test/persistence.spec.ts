import { existsSync, statSync } from 'node:fs';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { DatabaseBackupService } from '@/modules/system/database-backup.service';
import { resolveDatabaseFile } from '@/database/database-paths';
import { apiPath, createTestApp, resetDatabase } from './harness';

/**
 * Persistencia entre execucoes.
 *
 * Este e o teste que realmente importa para um aplicativo instalado:
 * cadastrar algo, FECHAR a aplicacao, abrir de novo e o dado continuar la.
 * Encerrar de verdade o modulo Nest (com `app.close()`) tambem exercita o
 * checkpoint do WAL no shutdown.
 */
describe('Persistencia entre reinicios', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const SETUP_PAYLOAD = {
    owner: { name: 'Dona da Loja', email: 'dona@loja.local', password: 'SenhaSegura123' },
    company: { name: 'Loja Persistente', segments: ['RETAIL'] },
  };

  const start = async () => {
    const context = await createTestApp();
    app = context.app;
    prisma = context.prisma;
  };

  /** Fecha a aplicacao como o Electron faria ao encerrar. */
  const stop = async () => {
    await app.close();
  };

  beforeAll(async () => {
    await start();
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await stop();
  });

  it('mantem empresa, usuario e produto depois de fechar e reabrir', async () => {
    // ---- primeira execucao: configura a instalacao e cadastra um produto ----
    await request(app.getHttpServer()).post(apiPath('/setup')).send(SETUP_PAYLOAD).expect(201);

    const login = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: SETUP_PAYLOAD.owner.email, password: SETUP_PAYLOAD.owner.password })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post(apiPath('/products'))
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ name: 'Cadeira Gamer', salePrice: 1299.9, sku: 'PERSIST-1' })
      .expect(201);

    expect(created.body.salePrice).toBe(1299.9);

    // ---- fecha a aplicacao ----
    await stop();

    // ---- segunda execucao: nada e recriado, o banco ja existe ----
    await start();

    const relogin = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: SETUP_PAYLOAD.owner.email, password: SETUP_PAYLOAD.owner.password })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(apiPath('/products?search=PERSIST-1'))
      .set('Authorization', `Bearer ${relogin.body.accessToken}`)
      .expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      name: 'Cadeira Gamer',
      sku: 'PERSIST-1',
      // Valor volta exato: centavos nao perdem precisao no caminho.
      salePrice: 1299.9,
    });

    // A instalacao continua marcada como configurada.
    const status = await request(app.getHttpServer()).get(apiPath('/setup/status')).expect(200);
    expect(status.body.required).toBe(false);
  });

  describe('backup', () => {
    it('gera um backup valido sem derrubar o banco em uso', async () => {
      const backupService = app.get(DatabaseBackupService);

      const result = await backupService.create();
      const backupPath = `${result.directory}/${result.filename}`;

      expect(existsSync(backupPath)).toBe(true);
      expect(statSync(backupPath).size).toBeGreaterThan(0);
      // Formato do nome nao pode conter ":" (invalido no Windows).
      expect(result.filename).toMatch(/^hub-backup-[\d-]+T[\d-]+\.db$/);
      expect(result.filename).not.toContain(':');

      // O banco original segue operacional depois do checkpoint + copia.
      const stillWorks = await prisma.organization.count();
      expect(stillWorks).toBeGreaterThan(0);
    });

    it('o backup e um banco SQLite legivel com os dados', async () => {
      const backupService = app.get(DatabaseBackupService);
      const result = await backupService.create();
      const backupPath = `${result.directory}/${result.filename}`;

      // Abre a COPIA e confirma que o produto cadastrado esta la.
      const { PrismaClient } = await import('@prisma/client');
      const copy = new PrismaClient({ datasources: { db: { url: `file:${backupPath}` } } });

      try {
        const products = await copy.product.findMany({ where: { sku: 'PERSIST-1' } });
        expect(products).toHaveLength(1);
        expect(products[0]?.salePriceCents).toBe(129990);
      } finally {
        await copy.$disconnect();
      }
    });

    it('lista os backups criados', () => {
      const backupService = app.get(DatabaseBackupService);
      const backups = backupService.list();

      expect(backups.length).toBeGreaterThan(0);
      expect(backups[0]?.filename).toContain('hub-backup-');
    });

    it('grava os backups fora do diretorio do banco', () => {
      const backupService = app.get(DatabaseBackupService);
      const databaseFile = resolveDatabaseFile(process.env.DATABASE_URL);

      // Backup no mesmo diretorio do banco seria perdido junto num problema
      // de disco e poluiria a pasta de dados.
      expect(backupService.getBackupDirectory()).not.toContain('/data');
      expect(databaseFile).toContain('/data/');
    });
  });
});
