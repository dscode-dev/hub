import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * Seed de desenvolvimento. Idempotente: pode rodar quantas vezes for preciso.
 * A senha e propositalmente fraca e serve apenas para ambiente local.
 */
const prisma = new PrismaClient();

const OWNER_EMAIL = 'owner@plataformahub.local';
const OWNER_PASSWORD = 'Hub@123456';

const CATEGORIES = [
  { name: 'Geral', description: 'Categoria padrao para produtos ainda nao classificados' },
  { name: 'Destaques', description: 'Produtos em evidencia na loja' },
  { name: 'Acessorios', description: 'Itens complementares e de menor valor' },
];

const PRODUCTS = [
  { name: 'Produto exemplo A', sku: 'EX-001', salePrice: 129.9, costPrice: 70, category: 'Geral', stock: 12 },
  { name: 'Produto exemplo B', sku: 'EX-002', salePrice: 349.0, costPrice: 210, category: 'Destaques', stock: 5 },
  { name: 'Produto exemplo C', sku: 'EX-003', salePrice: 89.5, costPrice: 41.2, category: 'Acessorios', stock: 40 },
  { name: 'Produto exemplo D', sku: 'EX-004', salePrice: 1899.9, costPrice: 1200, category: 'Destaques', stock: 2 },
  { name: 'Servico de instalacao', sku: 'EX-005', salePrice: 150.0, costPrice: null, category: null, stock: null },
];

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Plataforma Hub Demo',
      tradeName: 'Hub Demo',
      email: 'contato@plataformahub.local',
      phone: '(11) 90000-0000',
    },
  });

  const passwordHash = await hash(OWNER_PASSWORD, 12);

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { passwordHash, active: true, organizationId: organization.id },
    create: {
      organizationId: organization.id,
      name: 'Proprietario Demo',
      email: OWNER_EMAIL,
      passwordHash,
      role: 'OWNER',
    },
  });

  const categoryIds = new Map<string, string>();

  for (const category of CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: category.name } },
      update: { description: category.description },
      create: {
        organizationId: organization.id,
        name: category.name,
        description: category.description,
      },
    });

    categoryIds.set(category.name, created.id);
  }

  for (const product of PRODUCTS) {
    const categoryId = product.category ? (categoryIds.get(product.category) ?? null) : null;

    await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: organization.id, sku: product.sku } },
      update: {},
      create: {
        organizationId: organization.id,
        categoryId,
        name: product.name,
        sku: product.sku,
        salePrice: new Prisma.Decimal(product.salePrice),
        costPrice: product.costPrice === null ? null : new Prisma.Decimal(product.costPrice),
        trackInventory: product.stock !== null,
        stockQuantity: new Prisma.Decimal(product.stock ?? 0),
        minStockQuantity: product.stock !== null ? new Prisma.Decimal(3) : null,
      },
    });
  }

  console.log('Seed concluido.');
  console.log(`  Organizacao : ${organization.name}`);
  console.log(`  Usuario     : ${owner.email}`);
  console.log(`  Senha       : ${OWNER_PASSWORD} (apenas para ambiente local)`);
}

main()
  .catch((error: unknown) => {
    console.error('Falha no seed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
