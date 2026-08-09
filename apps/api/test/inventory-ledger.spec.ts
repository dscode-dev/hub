import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant, type SeededTenant } from './harness';

/**
 * Ledger de estoque.
 *
 * O invariante central desta etapa: o saldo e CONSEQUENCIA das movimentacoes,
 * nunca um numero editavel. Estes testes cobrem exatamente isso - atomicidade,
 * imutabilidade e a impossibilidade de saldo negativo por engano.
 */
describe('Ledger de estoque', () => {
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
    tenant = await seedTenant(prisma, { name: 'Loja do Ledger' });
    token = await login(tenant);
  });

  const createProduct = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(apiPath('/products'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cafe Premium', salePrice: 29.9, trackInventory: true, ...body });

  const move = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(apiPath('/inventory/movements'))
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const balanceOf = async (productId: string): Promise<number> => {
    const balance = await prisma.inventoryBalance.findUnique({ where: { productId } });
    return balance?.quantityMilli ?? 0;
  };

  describe('estoque inicial', () => {
    it('vira movimento INITIAL_STOCK, e nao campo do produto', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      const movements = await prisma.inventoryMovement.findMany({
        where: { productId: product.body.id },
      });

      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({
        type: 'INITIAL_STOCK',
        quantityMilli: 10_000,
        balanceAfterMilli: 10_000,
      });
    });

    it('atualiza o saldo na mesma operacao', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      expect(await balanceOf(product.body.id)).toBe(10_000);
      expect(product.body.inventory.quantity).toBe(10);
    });

    it('nao cria movimento quando o produto nao controla estoque', async () => {
      const product = await createProduct({
        trackInventory: false,
        initialQuantity: 10,
      }).expect(201);

      expect(await prisma.inventoryMovement.count({ where: { productId: product.body.id } })).toBe(
        0,
      );
    });

    it('nao cria movimento quando a quantidade inicial e zero', async () => {
      const product = await createProduct({ initialQuantity: 0 }).expect(201);

      expect(await prisma.inventoryMovement.count({ where: { productId: product.body.id } })).toBe(
        0,
      );
    });
  });

  describe('entradas e saidas', () => {
    it('entrada aumenta o saldo', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      const movement = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_IN',
        quantity: 5,
        reason: 'Contagem encontrou unidades a mais',
      }).expect(201);

      expect(movement.body.quantity).toBe(5);
      expect(movement.body.balanceAfter).toBe(15);
      expect(await balanceOf(product.body.id)).toBe(15_000);
    });

    it('saida reduz o saldo e e gravada com sinal negativo', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      const movement = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_OUT',
        quantity: 2,
        reason: 'Uso interno',
      }).expect(201);

      // O cliente envia sempre positivo; o sinal vem do tipo.
      expect(movement.body.quantity).toBe(-2);
      expect(movement.body.balanceAfter).toBe(8);
      expect(await balanceOf(product.body.id)).toBe(8_000);
    });

    it('o saldo e a soma do ledger: +10 +5 -2 = 13', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      await move({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 5 }).expect(201);
      await move({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 2 }).expect(201);

      const sum = await prisma.inventoryMovement.aggregate({
        where: { productId: product.body.id },
        _sum: { quantityMilli: true },
      });

      // Projecao e ledger precisam concordar - sempre.
      expect(sum._sum.quantityMilli).toBe(13_000);
      expect(await balanceOf(product.body.id)).toBe(13_000);
    });

    it('guarda o saldo apos cada movimento, para o extrato', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);
      await move({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 5 }).expect(201);
      await move({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 2 }).expect(201);

      const movements = await prisma.inventoryMovement.findMany({
        where: { productId: product.body.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(movements.map((movement) => movement.balanceAfterMilli)).toEqual([
        10_000, 15_000, 13_000,
      ]);
    });
  });

  describe('estoque negativo', () => {
    it('recusa saida maior que o saldo', async () => {
      const product = await createProduct({ initialQuantity: 2 }).expect(201);

      const response = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_OUT',
        quantity: 3,
      }).expect(409);

      expect(response.body.message).toContain('Estoque insuficiente');
      // A mensagem precisa dizer quanto ha disponivel.
      expect(response.body.message).toContain('2');
    });

    it('nao deixa rastro quando a saida e recusada', async () => {
      const product = await createProduct({ initialQuantity: 2 }).expect(201);

      await move({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 3 }).expect(409);

      // Nem movimento, nem saldo alterado: a transacao inteira foi desfeita.
      expect(await prisma.inventoryMovement.count({ where: { productId: product.body.id } })).toBe(
        1,
      );
      expect(await balanceOf(product.body.id)).toBe(2_000);
    });

    it('permite negativo quando a organizacao autoriza', async () => {
      await prisma.organization.update({
        where: { id: tenant.organizationId },
        data: { allowNegativeInventory: true },
      });

      const product = await createProduct({ initialQuantity: 2 }).expect(201);

      await move({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 3 }).expect(201);

      expect(await balanceOf(product.body.id)).toBe(-1_000);
    });
  });

  describe('unidade de medida', () => {
    /** Ids fixos criados pela migration `default_units`. */
    const UNIT_UN = '00000000-0000-4000-9000-000000000001';
    const UNIT_KG = '00000000-0000-4000-9000-000000000002';

    it('assume "UN" quando o produto nao escolhe unidade', async () => {
      const product = await createProduct({}).expect(201);

      // Unidade nula significaria nao saber o que esta sendo contado.
      expect(product.body.unit).toMatchObject({ code: 'UN', allowsFraction: false });
    });

    it('recusa fracao em unidade que nao aceita fracao', async () => {
      const product = await createProduct({ unitId: UNIT_UN, initialQuantity: 10 }).expect(201);

      const response = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_IN',
        quantity: 2.5,
      }).expect(400);

      expect(response.body.message).toContain('nao aceita quantidade fracionada');
      expect(await balanceOf(product.body.id)).toBe(10_000);
    });

    it('aceita fracao em unidade que aceita, preservando 3 casas', async () => {
      const product = await createProduct({ unitId: UNIT_KG, initialQuantity: 10 }).expect(201);

      const movement = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_IN',
        quantity: 2.505,
      }).expect(201);

      expect(movement.body.balanceAfter).toBe(12.505);
      expect(await balanceOf(product.body.id)).toBe(12_505);
    });

    it('barra o estoque inicial fracionado tambem', async () => {
      // A regra vale em qualquer porta de entrada, nao so no movimento avulso.
      await createProduct({ unitId: UNIT_UN, initialQuantity: 1.5 }).expect(400);
    });
  });

  describe('produto sem controle de estoque', () => {
    it('recusa movimentacao', async () => {
      const product = await createProduct({ trackInventory: false }).expect(201);

      const response = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_IN',
        quantity: 5,
      }).expect(400);

      expect(response.body.message).toContain('nao controla estoque');
    });
  });

  describe('imutabilidade', () => {
    it('nao existe rota para editar nem apagar movimento', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);
      const movement = await move({
        productId: product.body.id,
        type: 'ADJUSTMENT_IN',
        quantity: 5,
      }).expect(201);

      // A API nao expoe PATCH nem DELETE de movimento - correcao se faz com
      // movimento compensatorio, preservando o historico.
      await request(app.getHttpServer())
        .patch(apiPath(`/inventory/movements/${movement.body.id}`))
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 99 })
        .expect(404);

      await request(app.getHttpServer())
        .delete(apiPath(`/inventory/movements/${movement.body.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('correcao acontece por movimento compensatorio', async () => {
      const product = await createProduct({ initialQuantity: 0 }).expect(201);

      // Lancamento errado de +10, depois corrigido para +8.
      await move({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 10 }).expect(201);
      await move({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 10 }).expect(201);
      await move({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 8 }).expect(201);

      expect(await balanceOf(product.body.id)).toBe(8_000);
      // Os tres lancamentos continuam no historico: nada foi reescrito.
      expect(await prisma.inventoryMovement.count({ where: { productId: product.body.id } })).toBe(
        3,
      );
    });
  });

  describe('quantidades fracionadas', () => {
    // Em KG: fracao so e valida numa unidade que aceita fracao, e e ai que a
    // precisao milesimal precisa ser exata (balanca de acougue, metro linear).
    const KG = { unitId: '00000000-0000-4000-9000-000000000002' };

    it.each([
      [1, 1_000],
      [1.5, 1_500],
      [0.001, 1],
      [0.25, 250],
      [1000, 1_000_000],
    ])('converte %s para %s milesimos sem perda', async (quantity, expected) => {
      const product = await createProduct({ ...KG, initialQuantity: quantity }).expect(201);

      expect(await balanceOf(product.body.id)).toBe(expected);
    });

    it('0,1 + 0,2 resulta em exatamente 0,3', async () => {
      const product = await createProduct({ ...KG, initialQuantity: 0.1 }).expect(201);

      await move({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 0.2 }).expect(201);

      // Em ponto flutuante isso daria 0.30000000000000004.
      expect(await balanceOf(product.body.id)).toBe(300);

      const detail = await request(app.getHttpServer())
        .get(apiPath(`/inventory/products/${product.body.id}`))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(detail.body.quantity).toBe(0.3);
    });
  });

  describe('status derivado', () => {
    it('reflete saldo e minimo', async () => {
      const product = await createProduct({ initialQuantity: 10, minimumStock: 5 }).expect(201);
      const id = product.body.id;

      const statusNow = async () => {
        const response = await request(app.getHttpServer())
          .get(apiPath(`/products/${id}`))
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        return response.body.inventory.status as string;
      };

      expect(await statusNow()).toBe('IN_STOCK');

      await move({ productId: id, type: 'ADJUSTMENT_OUT', quantity: 5 }).expect(201);
      expect(await statusNow()).toBe('LOW_STOCK');

      await move({ productId: id, type: 'ADJUSTMENT_OUT', quantity: 5 }).expect(201);
      expect(await statusNow()).toBe('OUT_OF_STOCK');
    });
  });

  describe('isolamento multi-tenant', () => {
    it('nao movimenta produto de outra organizacao', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      const other = await seedTenant(prisma, { name: 'Loja Invasora' });
      const otherToken = await login(other);

      await request(app.getHttpServer())
        .post(apiPath('/inventory/movements'))
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ productId: product.body.id, type: 'ADJUSTMENT_OUT', quantity: 5 })
        // 404, o mesmo de um id inexistente: nao confirma que o produto existe.
        .expect(404);

      // Saldo intacto: conhecer o UUID nao basta.
      expect(await balanceOf(product.body.id)).toBe(10_000);
    });

    it('nao lista o saldo de produto de outra organizacao', async () => {
      await createProduct({ name: 'Cafe da casa', initialQuantity: 10 }).expect(201);

      const other = await seedTenant(prisma, { name: 'Loja Vizinha' });
      const otherToken = await login(other);

      const list = await request(app.getHttpServer())
        .get(apiPath('/inventory'))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      // A projecao de saldo e tao scoped quanto o ledger que a origina.
      expect(list.body.data).toHaveLength(0);

      const summary = await request(app.getHttpServer())
        .get(apiPath('/inventory/summary'))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(summary.body.trackedProducts).toBe(0);
    });

    it('nao le o extrato de produto de outra organizacao', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      const other = await seedTenant(prisma, { name: 'Loja Curiosa' });
      const otherToken = await login(other);

      const movements = await request(app.getHttpServer())
        .get(apiPath(`/inventory/products/${product.body.id}/movements`))
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(movements.body.data).toHaveLength(0);
    });
  });

  describe('permissoes', () => {
    it('VIEWER nao registra movimentacao', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      const viewer = await seedTenant(prisma, { role: 'VIEWER' });
      const viewerToken = await login(viewer);

      await request(app.getHttpServer())
        .post(apiPath('/inventory/movements'))
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ productId: product.body.id, type: 'ADJUSTMENT_IN', quantity: 1 })
        .expect(403);
    });
  });

  describe('tipos gerados pelo sistema', () => {
    it('recusa lancar SALE manualmente', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      // Venda tem origem propria: aceitar aqui permitiria forjar historico.
      await move({ productId: product.body.id, type: 'SALE', quantity: 1 }).expect(400);
    });

    it('recusa lancar INITIAL_STOCK manualmente', async () => {
      const product = await createProduct({ initialQuantity: 10 }).expect(201);

      await move({ productId: product.body.id, type: 'INITIAL_STOCK', quantity: 1 }).expect(400);
    });
  });
});
