import type { Prisma } from '@prisma/client';
import type { ProductDto } from '@hub/shared';
import { fromCents, fromCentsOrNull, fromMilli, fromMilliOrNull } from '@/common/utils/money';

export const productInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithCategory = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * Traduz a linha do banco para o contrato da API.
 *
 * O armazenamento e inteiro (centavos e milesimos) por integridade; o contrato
 * publico continua em reais e unidades. A conversao vive so aqui e no service,
 * entao nenhuma unidade de persistencia vaza para controller ou frontend.
 */
export function toProductDto(product: ProductWithCategory): ProductDto {
  return {
    id: product.id,
    organizationId: product.organizationId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    categoryId: product.categoryId,
    category: product.category ? { id: product.category.id, name: product.category.name } : null,
    costPrice: fromCentsOrNull(product.costPriceCents),
    salePrice: fromCents(product.salePriceCents),
    active: product.active,
    trackInventory: product.trackInventory,
    stockQuantity: fromMilli(product.stockQuantityMilli),
    minStockQuantity: fromMilliOrNull(product.minStockQuantityMilli),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
