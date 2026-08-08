import type { Prisma } from '@prisma/client';
import type { ProductDto } from '@hub/shared';
import { decimalToNumber, requiredDecimalToNumber } from '@/common/utils/decimal';

export const productInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithCategory = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

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
    costPrice: decimalToNumber(product.costPrice),
    salePrice: requiredDecimalToNumber(product.salePrice),
    active: product.active,
    trackInventory: product.trackInventory,
    stockQuantity: requiredDecimalToNumber(product.stockQuantity),
    minStockQuantity: decimalToNumber(product.minStockQuantity),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
