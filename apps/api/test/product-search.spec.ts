import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant, type SeededTenant } from './harness';

/**
 * Busca de produtos.
 *
 * Encerra a limitacao conhecida do SQLite: sem colacao Unicode, "sofa" nunca
 * encontraria "SOFÁ". A coluna normalizada resolve isso sem extensao nativa e
 * sem alterar o texto que o usuario ve.
 */
describe('Busca de produtos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant: SeededTenant;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    tenant = await seedTenant(prisma, { name: 'Loja da Busca' });

    const login = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    token = login.body.accessToken as string;

    await request(app.getHttpServer())
      .post(apiPath('/products'))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'SOFÁ RETRÁTIL', salePrice: 1299.9, sku: 'SOF-01', barcode: '7891234567890' })
      .expect(201);
  });

  const search = async (term: string) => {
    const response = await request(app.getHttpServer())
      .get(apiPath(`/products?search=${encodeURIComponent(term)}`))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return response.body.data as { name: string }[];
  };

  describe('acentuacao e caixa', () => {
    it.each(['sofá', 'SOFÁ', 'sofa', 'SOFA', 'Sofa Retratil', 'sofá retrátil', 'RETRATIL'])(
      'encontra "SOFÁ RETRÁTIL" buscando por "%s"',
      async (term) => {
        const results = await search(term);

        expect(results).toHaveLength(1);
        // O nome original e preservado: normalizamos so o indice de busca.
        expect(results[0]?.name).toBe('SOFÁ RETRÁTIL');
      },
    );

    it('nao encontra termo que realmente nao existe', async () => {
      expect(await search('geladeira')).toHaveLength(0);
    });
  });

  describe('SKU e codigo de barras', () => {
    it.each(['SOF-01', 'sof-01', 'sof01'])('encontra pelo SKU "%s"', async (term) => {
      expect(await search(term)).toHaveLength(1);
    });

    it('encontra pelo codigo de barras', async () => {
      expect(await search('7891234567890')).toHaveLength(1);
    });
  });

  describe('unicidade normalizada', () => {
    it('trata SKU como case-insensitive', async () => {
      // "sof-01" e o mesmo codigo que "SOF-01" para quem digita no balcao.
      const response = await request(app.getHttpServer())
        .post(apiPath('/products'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Outro sofa', salePrice: 10, sku: 'sof-01' })
        .expect(409);

      expect(response.body.message).toContain('SKU');
    });

    it('mensagem de barcode duplicado aponta o produto existente', async () => {
      const response = await request(app.getHttpServer())
        .post(apiPath('/products'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Clone', salePrice: 10, barcode: '7891234567890' })
        .expect(409);

      expect(response.body.message).toContain('codigo de barras');
      expect(response.body.message).toContain('SOFÁ RETRÁTIL');
    });
  });

  describe('categorias', () => {
    it('nao duplica categoria por acento ou caixa', async () => {
      await request(app.getHttpServer())
        .post(apiPath('/categories'))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Eletrônicos' })
        .expect(201);

      for (const variant of ['eletronicos', 'ELETRÔNICOS', 'Eletronicos']) {
        await request(app.getHttpServer())
          .post(apiPath('/categories'))
          .set('Authorization', `Bearer ${token}`)
          .send({ name: variant })
          .expect(409);
      }

      expect(await prisma.category.count({ where: { organizationId: tenant.organizationId } })).toBe(
        1,
      );
    });
  });

  describe('filtro por status de estoque', () => {
    it('filtra apenas os produtos no status pedido', async () => {
      const create = (name: string, quantity: number, minimum: number) =>
        request(app.getHttpServer())
          .post(apiPath('/products'))
          .set('Authorization', `Bearer ${token}`)
          .send({
            name,
            salePrice: 10,
            trackInventory: true,
            initialQuantity: quantity,
            minimumStock: minimum,
          })
          .expect(201);

      await create('Com estoque', 20, 5);
      await create('Estoque baixo', 3, 5);
      await create('Sem estoque', 0, 5);

      const low = await request(app.getHttpServer())
        .get(apiPath('/products?stockStatus=LOW_STOCK'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const lowNames = (low.body.data as { name: string }[]).map((product) => product.name);
      expect(lowNames).toEqual([
        'Estoque baixo',
      ]);

      const out = await request(app.getHttpServer())
        .get(apiPath('/products?stockStatus=OUT_OF_STOCK'))
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const outNames = (out.body.data as { name: string }[]).map((product) => product.name);
      expect(outNames).toEqual([
        'Sem estoque',
      ]);
    });
  });
});
