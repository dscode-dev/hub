import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant } from './harness';

/**
 * Primeiro acesso da instalacao.
 *
 * O invariante testado aqui e o mais sensivel do sistema: uma rota publica que
 * cria o usuario mais poderoso da instalacao. Ela precisa funcionar exatamente
 * uma vez - inclusive sob requisicoes simultaneas.
 */
const VALID_PAYLOAD = {
  owner: {
    name: 'Maria Silva',
    email: 'maria@empresa.local',
    password: 'SenhaSegura123',
  },
  company: {
    name: 'Comercial Silva LTDA',
    tradeName: 'Casa Silva',
    document: '12.345.678/0001-99',
    phone: '(11) 99999-0000',
    segments: ['FURNITURE', 'RETAIL'],
    operationGoals: ['SELL_PRODUCTS', 'MANAGE_INVENTORY'],
    address: {
      zipCode: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      district: 'Bela Vista',
      city: 'Sao Paulo',
      state: 'sp',
      reference: 'Proximo ao MASP',
    },
  },
};

describe('Primeiro acesso (setup)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const postSetup = (payload: unknown) =>
    request(app.getHttpServer()).post(apiPath('/setup')).send(payload);

  describe('status', () => {
    it('exige setup em uma instalacao vazia', async () => {
      const response = await request(app.getHttpServer())
        .get(apiPath('/setup/status'))
        .expect(200);

      expect(response.body).toEqual({ required: true, completedAt: null });
    });

    it('deixa de exigir setup quando ja existe um OWNER', async () => {
      // Banco vindo de seed ou backup: nunca passou pelo wizard, mas ja tem dono.
      await seedTenant(prisma, { role: 'OWNER' });

      const response = await request(app.getHttpServer())
        .get(apiPath('/setup/status'))
        .expect(200);

      expect(response.body.required).toBe(false);
    });

    it('nao exige setup depois de concluido', async () => {
      await postSetup(VALID_PAYLOAD).expect(201);

      const response = await request(app.getHttpServer())
        .get(apiPath('/setup/status'))
        .expect(200);

      expect(response.body.required).toBe(false);
      expect(response.body.completedAt).toEqual(expect.any(String));
    });
  });

  describe('criacao', () => {
    it('cria empresa e usuario responsavel', async () => {
      const response = await postSetup(VALID_PAYLOAD).expect(201);

      expect(response.body).toMatchObject({
        organizationId: expect.any(String),
        userId: expect.any(String),
      });

      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: response.body.organizationId },
      });

      expect(organization).toMatchObject({
        name: 'Comercial Silva LTDA',
        tradeName: 'Casa Silva',
        addressCity: 'Sao Paulo',
        // UF e normalizada para maiuscula pelo DTO.
        addressState: 'SP',
        // Ponto de referencia so o cliente informa; nunca vem da consulta de CEP.
        addressReference: 'Proximo ao MASP',
      });
      // Listas vivem como JSON em texto no SQLite; o DTO devolve array.
      expect(JSON.parse(organization.segments)).toEqual(['FURNITURE', 'RETAIL']);
      // O wizard ja coletou tudo: o onboarding nao deve ser pedido de novo.
      expect(organization.onboardingCompletedAt).not.toBeNull();

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: response.body.userId },
      });

      expect(user.role).toBe('OWNER');
      expect(user.organizationId).toBe(organization.id);
      // Senha nunca em texto puro.
      expect(user.passwordHash).not.toContain('SenhaSegura123');
    });

    it('permite entrar imediatamente com as credenciais criadas', async () => {
      await postSetup(VALID_PAYLOAD).expect(201);

      const login = await request(app.getHttpServer())
        .post(apiPath('/auth/login'))
        .send({ email: VALID_PAYLOAD.owner.email, password: VALID_PAYLOAD.owner.password })
        .expect(200);

      expect(login.body.user.role).toBe('OWNER');
    });

    it('registra a conclusao na auditoria', async () => {
      const response = await postSetup(VALID_PAYLOAD).expect(201);

      const logs = await prisma.auditLog.findMany({
        where: { action: 'INSTANCE_SETUP_COMPLETED' },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.organizationId).toBe(response.body.organizationId);
    });
  });

  describe('bloqueio apos o primeiro acesso', () => {
    it('recusa um segundo setup', async () => {
      await postSetup(VALID_PAYLOAD).expect(201);

      const second = await postSetup({
        ...VALID_PAYLOAD,
        owner: { ...VALID_PAYLOAD.owner, email: 'outro@empresa.local' },
      }).expect(409);

      expect(second.body.message).toContain('ja foi configurada');
    });

    it('nao cria nada no segundo setup', async () => {
      await postSetup(VALID_PAYLOAD).expect(201);

      await postSetup({
        ...VALID_PAYLOAD,
        company: { ...VALID_PAYLOAD.company, name: 'Empresa Invasora' },
        owner: { ...VALID_PAYLOAD.owner, email: 'invasor@empresa.local' },
      }).expect(409);

      expect(await prisma.organization.count()).toBe(1);
      expect(await prisma.user.count()).toBe(1);
      expect(await prisma.organization.findFirst({ where: { name: 'Empresa Invasora' } })).toBeNull();
    });

    it('recusa setup quando ja existe OWNER, mesmo sem marcador', async () => {
      // Cenario real: banco restaurado de backup, sem a linha de instance_setup.
      await seedTenant(prisma, { role: 'OWNER' });
      expect(await prisma.instanceSetup.count()).toBe(0);

      await postSetup(VALID_PAYLOAD).expect(409);

      expect(await prisma.user.count()).toBe(1);
    });

    it('sob requisicoes simultaneas, apenas uma vence', async () => {
      const attempts = Array.from({ length: 5 }, (_, index) =>
        postSetup({
          ...VALID_PAYLOAD,
          owner: { ...VALID_PAYLOAD.owner, email: `dono${index}@empresa.local` },
        }),
      );

      const results = await Promise.all(attempts.map((call) => call.then((r) => r.status)));

      expect(results.filter((status) => status === 201)).toHaveLength(1);
      expect(results.filter((status) => status !== 201)).toHaveLength(4);

      // O que importa no fim: uma empresa, um dono.
      expect(await prisma.organization.count()).toBe(1);
      expect(await prisma.user.count({ where: { role: 'OWNER' } })).toBe(1);
    });
  });

  describe('validacao', () => {
    it('rejeita senha fraca', async () => {
      await postSetup({
        ...VALID_PAYLOAD,
        owner: { ...VALID_PAYLOAD.owner, password: 'curta1' },
      }).expect(400);

      expect(await prisma.organization.count()).toBe(0);
    });

    it('rejeita senha sem numero', async () => {
      await postSetup({
        ...VALID_PAYLOAD,
        owner: { ...VALID_PAYLOAD.owner, password: 'somenteletras' },
      }).expect(400);
    });

    it('rejeita e-mail invalido e nome de empresa ausente', async () => {
      await postSetup({
        ...VALID_PAYLOAD,
        owner: { ...VALID_PAYLOAD.owner, email: 'nao-e-email' },
      }).expect(400);

      await postSetup({
        ...VALID_PAYLOAD,
        company: { ...VALID_PAYLOAD.company, name: '' },
      }).expect(400);
    });

    it('rejeita logo com tipo nao suportado', async () => {
      await postSetup({
        ...VALID_PAYLOAD,
        company: {
          ...VALID_PAYLOAD.company,
          logo: 'data:application/pdf;base64,QUJD',
        },
      }).expect(400);
    });

    it('rejeita logo acima do limite de tamanho', async () => {
      // ~700 KB depois de decodificado, acima do teto de 512 KB.
      const oversized = 'A'.repeat(950_000);

      await postSetup({
        ...VALID_PAYLOAD,
        company: { ...VALID_PAYLOAD.company, logo: `data:image/png;base64,${oversized}` },
      }).expect(400);

      expect(await prisma.organization.count()).toBe(0);
    });

    it('aceita logo valida dentro do limite', async () => {
      const response = await postSetup({
        ...VALID_PAYLOAD,
        company: {
          ...VALID_PAYLOAD.company,
          logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        },
      }).expect(201);

      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: response.body.organizationId },
      });

      expect(organization.logo).toContain('data:image/png;base64,');
    });
  });
});
