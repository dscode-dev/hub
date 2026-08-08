import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { apiPath, createTestApp, resetDatabase, seedTenant, type SeededTenant } from './harness';

/**
 * Arquivo com colunas propositalmente fora do padrao do sistema:
 * o importador precisa funcionar sem exigir que o cliente renomeie nada.
 */
const CSV_CONTENT = [
  'Descricao do item;Valor;Codigo;Grupo;Qtde',
  'Cadeira de escritorio;R$ 459,90;CAD-01;Escritorio;10',
  'Mesa de reuniao;1.250,00;MES-01;Escritorio;3',
  ';99,90;SEM-NOME;Escritorio;1',
  'Item sem preco;;SEM-PRECO;Escritorio;1',
  'Luminaria;preco a combinar;LUM-01;Iluminacao;2',
  'Poltrona;780,00;POL-01;Sala;5',
].join('\n');

describe('Importacao de produtos por CSV', () => {
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
    tenant = await seedTenant(prisma, { name: 'Loja Importadora' });

    const login = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: tenant.email, password: tenant.password })
      .expect(200);

    token = login.body.accessToken as string;
  });

  const upload = () =>
    request(app.getHttpServer())
      .post(apiPath('/products/import/upload'))
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(CSV_CONTENT, 'utf-8'), 'produtos.csv');

  it('le as colunas e sugere o mapeamento mesmo com nomes diferentes', async () => {
    const response = await upload().expect(201);

    expect(response.body.columns).toEqual([
      'Descricao do item',
      'Valor',
      'Codigo',
      'Grupo',
      'Qtde',
    ]);
    expect(response.body.totalRows).toBe(6);
    expect(response.body.suggestedMapping).toMatchObject({
      name: 'Descricao do item',
      salePrice: 'Valor',
      sku: 'Codigo',
      categoryName: 'Grupo',
      stockQuantity: 'Qtde',
    });
  });

  it('reporta erros por linha no preview sem gravar nada', async () => {
    const uploaded = await upload().expect(201);

    const preview = await request(app.getHttpServer())
      .post(apiPath(`/products/import/${uploaded.body.importId}/preview`))
      .set('Authorization', `Bearer ${token}`)
      .send({ mapping: uploaded.body.suggestedMapping })
      .expect(201);

    expect(preview.body.totalRows).toBe(6);
    expect(preview.body.validRows).toBe(3);
    expect(preview.body.invalidRows).toBe(3);

    const productsCreated = await prisma.product.count({
      where: { organizationId: tenant.organizationId },
    });
    expect(productsCreated).toBe(0);
  });

  it('importa as linhas validas e reporta as invalidas sem cancelar o arquivo', async () => {
    const uploaded = await upload().expect(201);

    const commit = await request(app.getHttpServer())
      .post(apiPath(`/products/import/${uploaded.body.importId}/commit`))
      .set('Authorization', `Bearer ${token}`)
      .send({ mapping: uploaded.body.suggestedMapping })
      .expect(201);

    expect(commit.body.createdRows).toBe(3);
    expect(commit.body.failedRows).toBe(3);
    const errorLines = (commit.body.errors as { line: number }[]).map((error) => error.line);
    expect(errorLines).toEqual([4, 5, 6]);

    const products = await prisma.product.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { name: 'asc' },
    });

    expect(products.map((product) => product.name)).toEqual([
      'Cadeira de escritorio',
      'Mesa de reuniao',
      'Poltrona',
    ]);

    // "R$ 459,90" e "1.250,00" precisam virar centavos exatos - inteiros,
    // sem passar por ponto flutuante em nenhum momento do armazenamento.
    const cadeira = products.find((product) => product.sku === 'CAD-01');
    expect(cadeira?.salePriceCents).toBe(45990);
    const mesa = products.find((product) => product.sku === 'MES-01');
    expect(mesa?.salePriceCents).toBe(125000);
  });

  it('cria as categorias do arquivo sem duplicar', async () => {
    const uploaded = await upload().expect(201);

    await request(app.getHttpServer())
      .post(apiPath(`/products/import/${uploaded.body.importId}/commit`))
      .set('Authorization', `Bearer ${token}`)
      .send({ mapping: uploaded.body.suggestedMapping })
      .expect(201);

    const categories = await prisma.category.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { name: 'asc' },
    });

    expect(categories.map((category) => category.name)).toEqual(['Escritorio', 'Sala']);
  });

  it('impede acessar uma importacao de outra organizacao', async () => {
    const uploaded = await upload().expect(201);

    const otherTenant = await seedTenant(prisma, { name: 'Outra Loja' });
    const otherLogin = await request(app.getHttpServer())
      .post(apiPath('/auth/login'))
      .send({ email: otherTenant.email, password: otherTenant.password })
      .expect(200);

    await request(app.getHttpServer())
      .post(apiPath(`/products/import/${uploaded.body.importId}/commit`))
      .set('Authorization', `Bearer ${otherLogin.body.accessToken}`)
      .send({ mapping: uploaded.body.suggestedMapping })
      .expect(404);
  });
});
