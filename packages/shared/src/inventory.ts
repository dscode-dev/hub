/**
 * Contratos do dominio de estoque.
 *
 * A API publica sempre fala em unidades humanas ("15", "1,5"). Milesimos e
 * centavos sao detalhe de armazenamento e nao aparecem aqui.
 */

export const INVENTORY_MOVEMENT_TYPES = [
  'INITIAL_STOCK',
  'PURCHASE',
  'SALE',
  'SALE_RETURN',
  'PURCHASE_RETURN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'LOSS',
  'INVENTORY_GAIN',
  'INVENTORY_LOSS',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'OTHER_IN',
  'OTHER_OUT',
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  INITIAL_STOCK: 'Estoque inicial',
  PURCHASE: 'Compra',
  SALE: 'Venda',
  SALE_RETURN: 'Devolucao de venda',
  PURCHASE_RETURN: 'Devolucao ao fornecedor',
  ADJUSTMENT_IN: 'Ajuste de entrada',
  ADJUSTMENT_OUT: 'Ajuste de saida',
  DAMAGE: 'Avaria',
  LOSS: 'Perda',
  INVENTORY_GAIN: 'Sobra de inventario',
  INVENTORY_LOSS: 'Falta de inventario',
  TRANSFER_IN: 'Transferencia recebida',
  TRANSFER_OUT: 'Transferencia enviada',
  OTHER_IN: 'Outra entrada',
  OTHER_OUT: 'Outra saida',
};

/** Tipos que o usuario pode lancar manualmente na interface. */
export const MANUAL_INVENTORY_MOVEMENT_TYPES: InventoryMovementType[] = [
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'PURCHASE',
  'PURCHASE_RETURN',
  'DAMAGE',
  'LOSS',
  'OTHER_IN',
  'OTHER_OUT',
];

/**
 * Status de estoque.
 *
 * NUNCA persistido: e derivado do saldo + minimo + trackInventory. Guardar no
 * banco criaria uma terceira fonte de verdade para desincronizar.
 */
export const STOCK_STATUSES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'NOT_TRACKED'] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  IN_STOCK: 'Em estoque',
  LOW_STOCK: 'Estoque baixo',
  OUT_OF_STOCK: 'Sem estoque',
  NOT_TRACKED: 'Nao controlado',
};

export interface UnitOfMeasureDto {
  id: string;
  code: string;
  name: string;
  symbol: string;
  allowsFraction: boolean;
}

export interface ProductInventoryDto {
  /** Saldo em unidades humanas. */
  quantity: number;
  minimum: number | null;
  status: StockStatus;
  lastMovementAt: string | null;
}

export interface InventoryMovementDto {
  id: string;
  productId: string;
  productName: string;
  type: InventoryMovementType;
  /** Assinada: entrada positiva, saida negativa. */
  quantity: number;
  balanceAfter: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface InventoryItemDto {
  productId: string;
  name: string;
  sku: string | null;
  categoryName: string | null;
  unit: UnitOfMeasureDto | null;
  quantity: number;
  minimum: number | null;
  status: StockStatus;
  lastMovementAt: string | null;
}

export interface InventorySummaryDto {
  trackedProducts: number;
  lowStock: number;
  outOfStock: number;
}

export interface CreateMovementPayload {
  productId: string;
  type: InventoryMovementType;
  /** Unidades humanas, sempre positiva. O sinal vem do tipo. */
  quantity: number;
  unitCost?: number | null;
  reason?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Inventario fisico
// ---------------------------------------------------------------------------

export const INVENTORY_COUNT_STATUSES = [
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export type InventoryCountStatus = (typeof INVENTORY_COUNT_STATUSES)[number];

export const INVENTORY_COUNT_STATUS_LABELS: Record<InventoryCountStatus, string> = {
  DRAFT: 'Rascunho',
  IN_PROGRESS: 'Em contagem',
  COMPLETED: 'Concluido',
  CANCELLED: 'Cancelado',
};

export const INVENTORY_COUNT_SCOPES = ['ALL', 'CATEGORY', 'SELECTION'] as const;
export type InventoryCountScope = (typeof INVENTORY_COUNT_SCOPES)[number];

export interface InventoryCountItemDto {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unitSymbol: string | null;
  /** Saldo capturado quando o item entrou na contagem. */
  expected: number;
  counted: number | null;
  difference: number | null;
  /** true quando o saldo mudou depois do snapshot. */
  conflict: boolean;
}

export interface InventoryCountDto {
  id: string;
  status: InventoryCountStatus;
  scope: InventoryCountScope;
  categoryId: string | null;
  notes: string | null;
  totalItems: number;
  countedItems: number;
  createdAt: string;
  completedAt: string | null;
  items?: InventoryCountItemDto[];
}

export interface CreateInventoryCountPayload {
  scope: InventoryCountScope;
  categoryId?: string | null;
  productIds?: string[];
  notes?: string | null;
}

export interface InventoryCountConflictDto {
  productId: string;
  productName: string;
  expected: number;
  current: number;
}
