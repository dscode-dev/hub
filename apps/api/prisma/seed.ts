import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

/**
 * Seed de DESENVOLVIMENTO.
 *
 * Nunca roda na maquina do cliente: a instalacao real nasce vazia e e o wizard
 * de primeiro acesso que cria empresa e usuario. Colocar "Produto exemplo A" no
 * catalogo de uma loja de verdade seria pior do que inutil.
 *
 * Por isso o script se recusa a rodar fora de desenvolvimento.
 */
const prisma = new PrismaClient();

const OWNER_EMAIL = 'owner@plataformahub.local';
const OWNER_PASSWORD = 'Hub@123456';
const DEMO_ORG_ID = '00000000-0000-4000-8000-000000000001';
/** Unidade padrao criada pela migration de unidades. */
const UNIT_UN = '00000000-0000-4000-9000-000000000001';

const CATEGORIES = [
  { name: 'Geral', description: 'Categoria padrao para produtos ainda nao classificados' },
  { name: 'Destaques', description: 'Produtos em evidencia na loja' },
  { name: 'Acessorios', description: 'Itens complementares e de menor valor' },
];

/** Precos em reais; a conversao para centavos acontece na gravacao. */
const PRODUCTS = [
  { name: 'Produto exemplo A', sku: 'EX-001', salePrice: 129.9, costPrice: 70, category: 'Geral', stock: 12 },
  { name: 'Produto exemplo B', sku: 'EX-002', salePrice: 349.0, costPrice: 210, category: 'Destaques', stock: 5 },
  { name: 'Produto exemplo C', sku: 'EX-003', salePrice: 89.5, costPrice: 41.2, category: 'Acessorios', stock: 40 },
  { name: 'Produto exemplo D', sku: 'EX-004', salePrice: 1899.9, costPrice: 1200, category: 'Destaques', stock: 2 },
  { name: 'Servico de instalacao', sku: 'EX-005', salePrice: 150.0, costPrice: null, category: null, stock: null },
];

const toCents = (value: number): number => Math.round(Number((value * 100).toFixed(6)));
const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const toMilli = (value: number): number => Math.round(Number((value * 1000).toFixed(6)));

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'O seed e exclusivo de desenvolvimento e nao deve rodar em uma instalacao real.',
    );
  }

  const organization = await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: {
      id: DEMO_ORG_ID,
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
      where: {
        organizationId_nameNormalized: {
          organizationId: organization.id,
          nameNormalized: normalize(category.name),
        },
      },
      update: { description: category.description },
      create: {
        organizationId: organization.id,
        name: category.name,
        nameNormalized: normalize(category.name),
        description: category.description,
      },
    });

    categoryIds.set(category.name, created.id);
  }

  for (const product of PRODUCTS) {
    const categoryId = product.category ? (categoryIds.get(product.category) ?? null) : null;

    const created = await prisma.product.upsert({
      where: {
        organizationId_skuNormalized: {
          organizationId: organization.id,
          skuNormalized: normalize(product.sku).replace(/\s+/g, ''),
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        categoryId,
        unitId: UNIT_UN,
        name: product.name,
        searchName: normalize(product.name),
        sku: product.sku,
        skuNormalized: normalize(product.sku).replace(/\s+/g, ''),
        salePriceCents: toCents(product.salePrice),
        costPriceCents: product.costPrice === null ? null : toCents(product.costPrice),
        trackInventory: product.stock !== null,
        minimumStockMilli: product.stock !== null ? toMilli(3) : null,
      },
      select: { id: true },
    });

    /*
     * Estoque inicial tambem no seed passa pelo ledger: o saldo nunca e
     * escrito direto, nem em desenvolvimento. Assim o ambiente de dev exercita
     * exatamente o mesmo caminho da instalacao real.
     */
    if (product.stock !== null) {
      const alreadySeeded = await prisma.inventoryMovement.findFirst({
        where: { productId: created.id, type: 'INITIAL_STOCK' },
        select: { id: true },
      });

      if (!alreadySeeded) {
        const quantityMilli = toMilli(product.stock);

        await prisma.$transaction(async (tx) => {
          await tx.inventoryMovement.create({
            data: {
              organizationId: organization.id,
              productId: created.id,
              type: 'INITIAL_STOCK',
              quantityMilli,
              balanceAfterMilli: quantityMilli,
              reason: 'Estoque inicial (seed de desenvolvimento)',
              createdByUserId: owner.id,
            },
          });

          await tx.inventoryBalance.upsert({
            where: { productId: created.id },
            create: {
              organizationId: organization.id,
              productId: created.id,
              quantityMilli,
              lastMovementAt: new Date(),
            },
            update: { quantityMilli, lastMovementAt: new Date() },
          });
        });
      }
    }
  }

  console.log('Seed de desenvolvimento concluido.');
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
