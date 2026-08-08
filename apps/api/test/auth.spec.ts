import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant } from './harness';

describe('Autenticacao', () => {
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

  it('autentica com credenciais validas e devolve sessao + tokens', async () => {
    const tenant = await seedTenant(prisma, { name: 'Loja Alfa' });

    const response = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(tenant.email);
    expect(response.body.organization.id).toBe(tenant.organizationId);
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('rejeita senha incorreta sem revelar se o e-mail existe', async () => {
    const tenant = await seedTenant(prisma);

    const wrongPassword = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: 'SenhaErrada@1' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: 'nao-existe@teste.local', password: 'SenhaErrada@1' })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('bloqueia login de usuario desativado', async () => {
    const tenant = await seedTenant(prisma, { active: false });

    await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(401);
  });

  it('exige token valido em /auth/me', async () => {
    await request(app.getHttpServer()).get(apiPath('/auth/me')).expect(401);

    await request(app.getHttpServer())
      .get(apiPath('/auth/me'))
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('retorna a sessao do usuario autenticado em /auth/me', async () => {
    const tenant = await seedTenant(prisma);
    const login = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get(apiPath('/auth/me'))
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body.user.id).toBe(tenant.userId);
    expect(me.body.organization.id).toBe(tenant.organizationId);
  });

  it('rotaciona o refresh token e invalida o anterior', async () => {
    const tenant = await seedTenant(prisma);
    const login = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    const refreshed = await request(app.getHttpServer())
      .post(apiPath('/auth/refresh'))
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    // Reuso do token antigo nao pode funcionar.
    await request(app.getHttpServer())
      .post(apiPath('/auth/refresh'))
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('logout revoga o refresh token', async () => {
    const tenant = await seedTenant(prisma);
    const login = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    await request(app.getHttpServer())
      .post(apiPath('/auth/logout'))
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post(apiPath('/auth/refresh'))
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('registra o login na auditoria', async () => {
    const tenant = await seedTenant(prisma);

    await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    const logs = await prisma.auditLog.findMany({
      where: { organizationId: tenant.organizationId, action: 'AUTH_LOGIN' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.userId).toBe(tenant.userId);
  });
});
