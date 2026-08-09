import type { Prisma } from '@prisma/client';
import type { ProductDto, ProductInventoryDto, StockStatus, UnitOfMeasureDto } from '@hub/shared';
import { fromCents, fromCentsOrNull, fromMilli, fromMilliOrNull } from '@/common/utils/money';

/**
 * Leitura padrao de produto.
 *
 * Traz categoria, unidade e saldo numa unica query. E o que evita o N+1 da
 * listagem: sem isso, cem produtos virariam trezentas consultas.
 */
export const productInclude = {
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, code: true, name: true, symbol: true, allowsFraction: true } },
  balance: { select: { quantityMilli: true, lastMovementAt: true } },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/**
 * Status derivado, nunca persistido.
 *
 * Guardar no banco criaria uma terceira fonte de verdade (saldo, minimo e
 * status) que inevitavelmente divergiria.
 */
export function resolveStockStatus(
  trackInventory: boolean,
  quantityMilli: number,
  minimumMilli: number | null,
): StockStatus {
  if (!trackInventory) {
    return 'NOT_TRACKED';
  }

  if (quantityMilli <= 0) {
    return 'OUT_OF_STOCK';
  }

  if (minimumMilli !== null && quantityMilli <= minimumMilli) {
    return 'LOW_STOCK';
  }

  return 'IN_STOCK';
}

export function toUnitDto(
  unit: ProductWithRelations['unit'] | null,
): UnitOfMeasureDto | null {
  return unit
    ? {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        symbol: unit.symbol,
        allowsFraction: unit.allowsFraction,
      }
    : null;
}

export function toProductDto(product: ProductWithRelations): ProductDto {
  const quantityMilli = product.balance?.quantityMilli ?? 0;

  const inventory: ProductInventoryDto = {
    // Produto sem controle nao expoe saldo: o numero nao significaria nada.
    quantity: product.trackInventory ? fromMilli(quantityMilli) : 0,
    minimum: product.trackInventory ? fromMilliOrNull(product.minimumStockMilli) : null,
    status: resolveStockStatus(product.trackInventory, quantityMilli, product.minimumStockMilli),
    lastMovementAt: product.balance?.lastMovementAt?.toISOString() ?? null,
  };

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
    unit: toUnitDto(product.unit),
    inventory,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
