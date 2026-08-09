import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { DashboardMetricsDto } from '@hub/shared';
import { apiPath, createTestApp, resetDatabase, seedTenant, type SeededTenant } from './harness';

/**
 * Metricas da visao geral.
 *
 * O painel so vale se os numeros forem os da propria loja e vierem do que foi
 * realmente registrado. Estes testes cobrem as duas coisas: o calculo e o
 * isolamento entre organizacoes.
 */
describe('Metricas do dashboard', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant: SeededTenant;
  let token: string;

  const login = async (target: SeededTenant): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: target.email, password: target.password })
      .expect(200);

    return response.body.accessToken as string;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    tenant = await seedTenant(prisma, { name: 'Loja das Metricas' });
    token = await login(tenant);
  });

  const auth = <T extends request.Test>(req: T): T => req.set('Authorization', `Bearer ${token}`);

  const createProduct = (body: Record<string, unknown>) =>
    auth(request(app.getHttpServer()).post(apiPath('/products'))).send({
      salePrice: 10,
      trackInventory: true,
      ...body,
    });

  const metrics = async (): Promise<DashboardMetricsDto> => {
    const response = await auth(
      request(app.getHttpServer()).get(apiPath('/dashboard/metrics')),
    ).expect(200);

    return response.body as DashboardMetricsDto;
  };

  describe('indicadores', () => {
    it('soma saldos e valor do estoque a partir do que existe', async () => {
      await createProduct({ name: 'Cafe', salePrice: 20, costPrice: 8, initialQuantity: 10 });
      await createProduct({ name: 'Cha', salePrice: 5, costPrice: 2, initialQuantity: 4 });

      const body = await metrics();

      expect(body.kpis).toMatchObject({
        activeProducts: 2,
        trackedProducts: 2,
        totalUnits: 14,
        // 10x20 + 4x5
        stockValueSale: 220,
        // 10x8 + 4x2
        stockValueCost: 88,
      });
    });

    it('nao informa valor de custo quando nenhum produto tem custo', async () => {
      await createProduct({ name: 'Sem custo', initialQuantity: 5 });

      // Zero se leria como "estoque sem valor"; null diz "nao informado".
      expect((await metrics()).kpis.stockValueCost).toBeNull();
    });

    it('conta itens abaixo do minimo e zerados', async () => {
      await createProduct({ name: 'Cheio', initialQuantity: 20, minimumStock: 5 });
      await createProduct({ name: 'Baixo', initialQuantity: 3, minimumStock: 5 });
      await createProduct({ name: 'Zerado', initialQuantity: 0, minimumStock: 5 });

      const body = await metrics();

      expect(body.kpis).toMatchObject({ lowStock: 1, outOfStock: 1 });
      // Sem estoque antes de estoque baixo: urgencia primeiro.
      expect(body.alerts.map((alert) => alert.name)).toEqual(['Zerado', 'Baixo']);
    });
  });

  describe('serie mensal', () => {
    it('separa entradas de saidas no mes corrente', async () => {
      const product = await createProduct({ name: 'Cafe', initialQuantity: 10 }).expect(201);

      await auth(request(app.getHttpServer()).post(apiPath('/inventory/movements')))
        .send({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 5 })
        .expect(201);
      await auth(request(app.getHttpServer()).post(apiPath('/inventory/movements')))
        .send({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 2 })
        .expect(201);

      const body = await metrics();
      const current = body.monthly.at(-1);

      // Saida entra positiva na serie: comparar duas curvas exige mesmo eixo.
      expect(current).toMatchObject({ entries: 15, exits: 2, movements: 3 });
    });

    it('cobre seis meses, mesmo sem movimento neles', async () => {
      expect((await metrics()).monthly).toHaveLength(6);
    });

    it('nao inventa variacao quando nao ha mes anterior', async () => {
      await createProduct({ name: 'Cafe', initialQuantity: 10 });

      // Dividir por zero diria "aumento infinito", que nao informa nada.
      expect((await metrics()).comparison.entries.change).toBeNull();
    });
  });

  describe('cobertura por categoria', () => {
    it('distribui a participacao pelo saldo de cada categoria', async () => {
      const category = await auth(request(app.getHttpServer()).post(apiPath('/categories')))
        .send({ name: 'Bebidas' })
        .expect(201);

      await createProduct({ name: 'Cafe', categoryId: category.body.id, initialQuantity: 30 });
      await createProduct({ name: 'Avulso', initialQuantity: 10 });

      const { coverage } = await metrics();

      expect(coverage).toHaveLength(2);
      expect(coverage[0]).toMatchObject({ name: 'Bebidas', share: 0.75 });
      expect(coverage[1]).toMatchObject({ name: 'Sem categoria', share: 0.25 });
    });
  });

  describe('vendas', () => {
    it('declara que ainda nao ha modulo de vendas', async () => {
      // O frontend usa isso para reservar o espaco em vez de mostrar zeros.
      expect((await metrics()).salesAvailable).toBe(false);
    });
  });

  describe('isolamento multi-tenant', () => {
    it('nao mistura numeros de outra organizacao', async () => {
      await createProduct({ name: 'Cafe da casa', initialQuantity: 50 });

      const other = await seedTenant(prisma, { name: 'Loja Vizinha' });
      const otherToken = await login(other);

      const response = await request(app.getHttpServer())
        .get(apiPath('/dashboard/metrics'))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(response.body.kpis).toMatchObject({
        activeProducts: 0,
        totalUnits: 0,
        stockValueSale: 0,
      });
      expect(response.body.coverage).toHaveLength(0);
      expect(response.body.topProducts).toHaveLength(0);
    });

    it('exige autenticacao', async () => {
      await request(app.getHttpServer()).get(apiPath('/dashboard/metrics')).expect(401);
    });
  });
});
