import { STOCK_STATUS_LABELS, type StockStatus } from '@hub/shared';
import { STOCK_STATUS_STYLES } from '@/lib/inventory/format';
import { cn } from '@/lib/utils';

/** Selo de status derivado do saldo. Nunca vem do banco. */
export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STOCK_STATUS_STYLES[status],
        className,
      )}
    >
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}
