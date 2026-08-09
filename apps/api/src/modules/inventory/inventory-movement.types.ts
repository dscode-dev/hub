import type { InventoryMovementType } from '@prisma/client';

/**
 * Direcao de cada tipo de movimentacao.
 *
 * Fonte unica: o tipo determina o sinal, e o chamador nunca decide isso. Assim
 * uma `SALE` jamais entra como positiva por engano, e `SUM(quantityMilli)`
 * continua sendo o saldo.
 */
export const MOVEMENT_DIRECTION: Record<InventoryMovementType, 1 | -1> = {
  INITIAL_STOCK: 1,
  PURCHASE: 1,
  SALE_RETURN: 1,
  ADJUSTMENT_IN: 1,
  INVENTORY_GAIN: 1,
  TRANSFER_IN: 1,
  OTHER_IN: 1,

  SALE: -1,
  PURCHASE_RETURN: -1,
  ADJUSTMENT_OUT: -1,
  DAMAGE: -1,
  LOSS: -1,
  INVENTORY_LOSS: -1,
  TRANSFER_OUT: -1,
  OTHER_OUT: -1,
};

export function isInboundMovement(type: InventoryMovementType): boolean {
  return MOVEMENT_DIRECTION[type] === 1;
}

/**
 * Tipos que um usuario pode lancar manualmente.
 *
 * Os demais existem para ter origem em operacoes do sistema (venda, compra,
 * inventario) e nao devem ser criaveis a mao - senao o historico deixa de
 * refletir o que realmente aconteceu.
 */
export const MANUAL_MOVEMENT_TYPES: InventoryMovementType[] = [
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'LOSS',
  'OTHER_IN',
  'OTHER_OUT',
  'PURCHASE',
  'PURCHASE_RETURN',
];

export function isManualMovementType(type: InventoryMovementType): boolean {
  return MANUAL_MOVEMENT_TYPES.includes(type);
}

/** Origem de um movimento, para rastrear de onde ele veio. */
export const MOVEMENT_REFERENCE = {
  inventoryCount: 'INVENTORY_COUNT',
  productImport: 'PRODUCT_IMPORT',
} as const;
