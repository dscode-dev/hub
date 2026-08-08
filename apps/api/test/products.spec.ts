import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant, type SeededTenant } from './harness';

describe('Produtos', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tenantA: SeededTenant;
  let tenantB: SeededTenant;
  let tokenA: string;
  let tokenB: string;

  const login = async (tenant: SeededTenant): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
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
    tenantA = await seedTenant(prisma, { name: 'Loja Alfa' });
    tenantB = await seedTenant(prisma, { name: 'Loja Beta' });
    tokenA = await login(tenantA);
    tokenB = await login(tenantB);
  });

  const createProduct = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(apiPath('/products'))
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  describe('criacao', () => {
    it('cria com o minimo de campos: nome e preco de venda', async () => {
      const response = await createProduct(tokenA, {
        name: 'Sofa 3 lugares',
        salePrice: 1299.9,
      }).expect(201);

      expect(response.body).toMatchObject({
        name: 'Sofa 3 lugares',
        salePrice: 1299.9,
        active: true,
        trackInventory: false,
        organizationId: tenantA.organizationId,
      });
    });

    it('ignora organizationId enviado pelo cliente', async () => {
      // whitelist + forbidNonWhitelisted: campo desconhecido derruba a requisicao.
      await createProduct(tokenA, {
        name: 'Tentativa de cross-tenant',
        salePrice: 10,
        organizationId: tenantB.organizationId,
      }).expect(400);

      const productsInB = await prisma.product.count({
        where: { organizationId: tenantB.organizationId },
      });
      expect(productsInB).toBe(0);
    });

    it('rejeita preco de venda ausente ou negativo', async () => {
      await createProduct(tokenA, { name: 'Sem preco' }).expect(400);
      await createProduct(tokenA, { name: 'Preco negativo', salePrice: -1 }).expect(400);
    });

    it('permite o mesmo SKU em organizacoes diferentes', async () => {
      await createProduct(tokenA, { name: 'Produto A', salePrice: 10, sku: 'REPETIDO' }).expect(201);
      await createProduct(tokenB, { name: 'Produto B', salePrice: 20, sku: 'REPETIDO' }).expect(201);
    });

    it('rejeita SKU repetido dentro da mesma organizacao', async () => {
      await createProduct(tokenA, { name: 'Produto A', salePrice: 10, sku: 'UNICO' }).expect(201);
      await createProduct(tokenA, { name: 'Produto B', salePrice: 20, sku: 'UNICO' }).expect(409);
    });

    it('grava estoque apenas quando o controle esta ligado', async () => {
      const withoutTracking = await createProduct(tokenA, {
        name: 'Servico',
        salePrice: 100,
        stockQuantity: 30,
      }).expect(201);
      expect(withoutTracking.body.stockQuantity).toBe(0);

      const withTracking = await createProduct(tokenA, {
        name: 'Cadeira',
        salePrice: 100,
        trackInventory: true,
        stockQuantity: 30,
        minStockQuantity: 5,
      }).expect(201);
      expect(withTracking.body.stockQuantity).toBe(30);
      expect(withTracking.body.minStockQuantity).toBe(5);
    });

    it('registra a criacao na auditoria', async () => {
      const response = await createProduct(tokenA, { name: 'Auditado', salePrice: 50 }).expect(201);

      const logs = await prisma.auditLog.findMany({
        where: { organizationId: tenantA.organizationId, action: 'PRODUCT_CREATED' },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.entityId).toBe(response.body.id);
    });
  });

  describe('isolamento multi-tenant', () => {
    it('nao lista produtos de outra organizacao', async () => {
      await createProduct(tokenA, { name: 'Produto da Alfa', salePrice: 10 }).expect(201);

      const listB = await request(app.getHttpServer())
        .get(apiPath('/products'))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(listB.body.data).toHaveLength(0);
      expect(listB.body.meta.total).toBe(0);
    });

    it('retorna 404 ao ler produto de outra organizacao (sem vazar existencia)', async () => {
      const created = await createProduct(tokenA, { name: 'Privado', salePrice: 10 }).expect(201);

      await request(app.getHttpServer())
        .get(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('impede atualizar produto de outra organizacao', async () => {
      const created = await createProduct(tokenA, { name: 'Privado', salePrice: 10 }).expect(201);

      await request(app.getHttpServer())
        .patch(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Invadido' })
        .expect(404);

      const untouched = await prisma.product.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(untouched.name).toBe('Privado');
    });

    it('impede remover produto de outra organizacao', async () => {
      const created = await createProduct(tokenA, { name: 'Privado', salePrice: 10 }).expect(201);

      await request(app.getHttpServer())
        .delete(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      const untouched = await prisma.product.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(untouched.active).toBe(true);
    });

    it('recusa vincular categoria de outra organizacao', async () => {
      const categoryB = await prisma.category.create({
        data: { organizationId: tenantB.organizationId, name: 'Categoria da Beta' },
      });

      await createProduct(tokenA, {
        name: 'Produto',
        salePrice: 10,
        categoryId: categoryB.id,
      }).expect(400);
    });
  });

  describe('atualizacao', () => {
    it('atualiza apenas os campos enviados', async () => {
      const created = await createProduct(tokenA, {
        name: 'Mesa',
        salePrice: 500,
        sku: 'MESA-1',
      }).expect(201);

      const updated = await request(app.getHttpServer())
        .patch(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ salePrice: 550 })
        .expect(200);

      expect(updated.body.salePrice).toBe(550);
      expect(updated.body.name).toBe('Mesa');
      expect(updated.body.sku).toBe('MESA-1');
    });

    it('zera o estoque ao desligar o controle de inventario', async () => {
      const created = await createProduct(tokenA, {
        name: 'Cadeira',
        salePrice: 100,
        trackInventory: true,
        stockQuantity: 12,
        minStockQuantity: 3,
      }).expect(201);

      const updated = await request(app.getHttpServer())
        .patch(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ trackInventory: false })
        .expect(200);

      expect(updated.body.stockQuantity).toBe(0);
      expect(updated.body.minStockQuantity).toBeNull();
    });

    it('registra a alteracao na auditoria', async () => {
      const created = await createProduct(tokenA, { name: 'Mesa', salePrice: 500 }).expect(201);

      await request(app.getHttpServer())
        .patch(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Mesa de jantar' })
        .expect(200);

      const logs = await prisma.auditLog.findMany({
        where: { organizationId: tenantA.organizationId, action: 'PRODUCT_UPDATED' },
      });
      expect(logs).toHaveLength(1);
    });
  });

  describe('remocao (soft delete)', () => {
    it('desativa o produto em vez de apagar', async () => {
      const created = await createProduct(tokenA, { name: 'Descontinuado', salePrice: 10 }).expect(
        201,
      );

      const removed = await request(app.getHttpServer())
        .delete(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(removed.body.active).toBe(false);

      const stillInDatabase = await prisma.product.findUnique({ where: { id: created.body.id } });
      expect(stillInDatabase).not.toBeNull();
      expect(stillInDatabase?.active).toBe(false);
    });

    it('some da listagem padrao mas aparece com active=false', async () => {
      const created = await createProduct(tokenA, { name: 'Descontinuado', salePrice: 10 }).expect(
        201,
      );

      await request(app.getHttpServer())
        .delete(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const defaultList = await request(app.getHttpServer())
        .get(apiPath('/products'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(defaultList.body.data).toHaveLength(0);

      const inactiveList = await request(app.getHttpServer())
        .get(apiPath('/products?active=false'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(inactiveList.body.data).toHaveLength(1);
    });

    it('registra a desativacao na auditoria', async () => {
      const created = await createProduct(tokenA, { name: 'Descontinuado', salePrice: 10 }).expect(
        201,
      );

      await request(app.getHttpServer())
        .delete(apiPath(`/products/${created.body.id}`))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const logs = await prisma.auditLog.findMany({
        where: { organizationId: tenantA.organizationId, action: 'PRODUCT_DEACTIVATED' },
      });
      expect(logs).toHaveLength(1);
    });
  });

  describe('busca e paginacao', () => {
    it('busca por nome, SKU e codigo de barras', async () => {
      await createProduct(tokenA, {
        name: 'Sofa retratil',
        salePrice: 10,
        sku: 'SOF-99',
        barcode: '7890000000001',
      }).expect(201);
      await createProduct(tokenA, { name: 'Mesa de centro', salePrice: 20 }).expect(201);

      const byName = await request(app.getHttpServer())
        .get(apiPath('/products?search=sofa'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(byName.body.data).toHaveLength(1);

      const bySku = await request(app.getHttpServer())
        .get(apiPath('/products?search=SOF-99'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(bySku.body.data).toHaveLength(1);

      const byBarcode = await request(app.getHttpServer())
        .get(apiPath('/products?search=7890000000001'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(byBarcode.body.data).toHaveLength(1);
    });

    it('respeita page e pageSize', async () => {
      for (let index = 0; index < 3; index += 1) {
        await createProduct(tokenA, { name: `Produto ${index}`, salePrice: 10 }).expect(201);
      }

      const page = await request(app.getHttpServer())
        .get(apiPath('/products?page=2&pageSize=2'))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    });
  });
});
