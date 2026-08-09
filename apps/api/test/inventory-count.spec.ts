import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant, type SeededTenant } from './harness';

/**
 * Inventario fisico.
 *
 * O ponto sensivel e a concorrencia: uma contagem iniciada de manha nao pode
 * sobrescrever as vendas da tarde. O snapshot e a deteccao de conflito
 * existem exatamente para isso.
 */
describe('Inventario fisico', () => {
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
    tenant = await seedTenant(prisma, { name: 'Loja do Inventario' });
    token = await login(tenant);
  });

  const auth = (call: request.Test) => call.set('Authorization', `Bearer ${token}`);

  const createProduct = (name: string, initialQuantity: number) =>
    auth(request(app.getHttpServer()).post(apiPath('/products'))).send({
      name,
      salePrice: 10,
      trackInventory: true,
      initialQuantity,
    });

  const openCount = () =>
    auth(request(app.getHttpServer()).post(apiPath('/inventory/counts'))).send({ scope: 'ALL' });

  const saveItems = (countId: string, items: { productId: string; counted: number | null }[]) =>
    auth(request(app.getHttpServer()).patch(apiPath(`/inventory/counts/${countId}/items`))).send({
      items,
    });

  const complete = (countId: string) =>
    auth(request(app.getHttpServer()).post(apiPath(`/inventory/counts/${countId}/complete`)));

  const balanceOf = async (productId: string): Promise<number> => {
    const balance = await prisma.inventoryBalance.findUnique({ where: { productId } });
    return balance?.quantityMilli ?? 0;
  };

  describe('abertura', () => {
    it('cria a contagem com snapshot do saldo de cada produto', async () => {
      const productA = await createProduct('Produto A', 10).expect(201);
      const productB = await createProduct('Produto B', 5).expect(201);

      const count = await openCount().expect(201);

      expect(count.body.status).toBe('IN_PROGRESS');
      expect(count.body.totalItems).toBe(2);

      const items = count.body.items as { productId: string; expected: number }[];
      expect(items.find((item) => item.productId === productA.body.id)?.expected).toBe(10);
      expect(items.find((item) => item.productId === productB.body.id)?.expected).toBe(5);
    });

    it('ignora produtos sem controle de estoque', async () => {
      await createProduct('Controlado', 10).expect(201);
      await auth(request(app.getHttpServer()).post(apiPath('/products')))
        .send({ name: 'Servico', salePrice: 50, trackInventory: false })
        .expect(201);

      const count = await openCount().expect(201);

      expect(count.body.totalItems).toBe(1);
    });

    it('recusa abrir contagem sem nenhum produto controlado', async () => {
      await openCount().expect(400);
    });
  });

  describe('conclusao', () => {
    it('contagem igual ao sistema nao gera movimento', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 10 }]).expect(200);
      const completed = await complete(count.body.id).expect(201);

      expect(completed.body.status).toBe('COMPLETED');
      // Apenas o estoque inicial permanece.
      expect(await prisma.inventoryMovement.count({ where: { productId: product.body.id } })).toBe(
        1,
      );
      expect(await balanceOf(product.body.id)).toBe(10_000);
    });

    it('contado a menos gera INVENTORY_LOSS', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 8 }]).expect(200);
      await complete(count.body.id).expect(201);

      const movement = await prisma.inventoryMovement.findFirstOrThrow({
        where: { productId: product.body.id, type: 'INVENTORY_LOSS' },
      });

      expect(movement.quantityMilli).toBe(-2_000);
      expect(movement.balanceAfterMilli).toBe(8_000);
      // Rastreabilidade: da para voltar da movimentacao ate a contagem.
      expect(movement.referenceType).toBe('INVENTORY_COUNT');
      expect(movement.referenceId).toBe(count.body.id);
      expect(await balanceOf(product.body.id)).toBe(8_000);
    });

    it('contado a mais gera INVENTORY_GAIN', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 12 }]).expect(200);
      await complete(count.body.id).expect(201);

      const movement = await prisma.inventoryMovement.findFirstOrThrow({
        where: { productId: product.body.id, type: 'INVENTORY_GAIN' },
      });

      expect(movement.quantityMilli).toBe(2_000);
      expect(await balanceOf(product.body.id)).toBe(12_000);
    });

    it('aplica ajustes de varios produtos de uma vez', async () => {
      const a = await createProduct('Produto A', 10).expect(201);
      const b = await createProduct('Produto B', 5).expect(201);
      const c = await createProduct('Produto C', 7).expect(201);

      const count = await openCount().expect(201);

      await saveItems(count.body.id, [
        { productId: a.body.id, counted: 8 },
        { productId: b.body.id, counted: 5 },
        { productId: c.body.id, counted: 9 },
      ]).expect(200);

      await complete(count.body.id).expect(201);

      expect(await balanceOf(a.body.id)).toBe(8_000);
      // Sem diferenca, sem movimento.
      expect(await balanceOf(b.body.id)).toBe(5_000);
      expect(await balanceOf(c.body.id)).toBe(9_000);
    });

    it('recusa concluir sem nenhum item contado', async () => {
      await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await complete(count.body.id).expect(400);
    });

    it('nao permite concluir duas vezes', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 8 }]).expect(200);
      await complete(count.body.id).expect(201);

      // Segunda conclusao aplicaria o ajuste de novo.
      await complete(count.body.id).expect(409);
      expect(await balanceOf(product.body.id)).toBe(8_000);
    });
  });

  describe('conflito de concorrencia', () => {
    it('detecta movimento ocorrido durante a contagem', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 8 }]).expect(200);

      // Uma saida acontece DEPOIS do snapshot - como uma venda no balcao.
      await auth(request(app.getHttpServer()).post(apiPath('/inventory/movements')))
        .send({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 3 })
        .expect(201);

      const response = await complete(count.body.id).expect(409);

      expect(response.body.message).toContain('mudou durante a contagem');
      // O saldo real e preservado: a contagem antiga nao sobrescreve a venda.
      expect(await balanceOf(product.body.id)).toBe(7_000);
    });

    it('diz quais produtos mudaram, e nao so que algo mudou', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 8 }]).expect(200);

      await auth(request(app.getHttpServer()).post(apiPath('/inventory/movements')))
        .send({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 3 })
        .expect(201);

      const response = await complete(count.body.id).expect(409);

      // Sem esta lista o operador teria que recontar tudo para achar o item.
      expect(response.body.conflicts).toEqual([
        {
          productId: product.body.id,
          productName: 'Produto A',
          expected: 10,
          current: 7,
        },
      ]);
    });

    it('nao aplica nenhum ajuste quando ha conflito', async () => {
      const a = await createProduct('Produto A', 10).expect(201);
      const b = await createProduct('Produto B', 5).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [
        { productId: a.body.id, counted: 8 },
        { productId: b.body.id, counted: 4 },
      ]).expect(200);

      await auth(request(app.getHttpServer()).post(apiPath('/inventory/movements')))
        .send({ productId: a.body.id, type: 'ADJUSTMENT_OUT', quantity: 1 })
        .expect(201);

      await complete(count.body.id).expect(409);

      // Nem o produto sem conflito foi ajustado: a conclusao e tudo ou nada.
      expect(await balanceOf(b.body.id)).toBe(5_000);
    });

    it('sinaliza o conflito no detalhe antes de tentar concluir', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await auth(request(app.getHttpServer()).post(apiPath('/inventory/movements')))
        .send({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 4 })
        .expect(201);

      const detail = await auth(
        request(app.getHttpServer()).get(apiPath(`/inventory/counts/${count.body.id}`)),
      ).expect(200);

      expect(detail.body.items[0].conflict).toBe(true);
    });
  });

  describe('cancelamento', () => {
    it('cancela sem gerar ajustes', async () => {
      const product = await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      await saveItems(count.body.id, [{ productId: product.body.id, counted: 3 }]).expect(200);
      await auth(
        request(app.getHttpServer()).post(apiPath(`/inventory/counts/${count.body.id}/cancel`)),
      ).expect(201);

      expect(await balanceOf(product.body.id)).toBe(10_000);
      await complete(count.body.id).expect(409);
    });
  });

  describe('isolamento multi-tenant', () => {
    it('nao acessa inventario de outra organizacao', async () => {
      await createProduct('Produto A', 10).expect(201);
      const count = await openCount().expect(201);

      const other = await seedTenant(prisma, { name: 'Loja Invasora' });
      const otherToken = await login(other);

      await request(app.getHttpServer())
        .get(apiPath(`/inventory/counts/${count.body.id}`))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .post(apiPath(`/inventory/counts/${count.body.id}/complete`))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });
});
