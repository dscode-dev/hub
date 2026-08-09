import type { StockStatus, UnitOfMeasureDto } from '@hub/shared';

/**
 * Apresentacao de estoque.
 *
 * A interface nunca mostra milesimos: o backend ja devolve unidades humanas e
 * aqui apenas formatamos com o simbolo da unidade.
 */
const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export function formatStock(quantity: number, unit?: UnitOfMeasureDto | null): string {
  const value = quantityFormatter.format(quantity);
  return unit ? `${value} ${unit.symbol}` : value;
}

/** Quantidade com sinal explicito, para o extrato de movimentacoes. */
export function formatSignedStock(quantity: number, unit?: UnitOfMeasureDto | null): string {
  const sign = quantity > 0 ? '+' : '';
  return `${sign}${formatStock(quantity, unit)}`;
}

/** Cores do status: discretas, sem transformar a tabela em semaforo. */
export const STOCK_STATUS_STYLES: Record<StockStatus, string> = {
  IN_STOCK: 'bg-success-surface text-success',
  LOW_STOCK: 'bg-warning-surface text-warning',
  OUT_OF_STOCK: 'bg-danger-surface text-danger',
  NOT_TRACKED: 'bg-surface-muted text-foreground-subtle',
};
