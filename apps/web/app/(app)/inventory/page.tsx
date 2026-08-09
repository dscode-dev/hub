'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, PackageSearch } from 'lucide-react';
import {
  STOCK_STATUS_LABELS,
  type InventoryItemDto,
  type InventorySummaryDto,
  type Paginated,
  type StockStatus,
} from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { StockBadge } from '@/components/inventory/stock-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { formatStock } from '@/lib/inventory/format';
import { productDetailRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

type Filter = 'ALL' | Extract<StockStatus, 'LOW_STOCK' | 'OUT_OF_STOCK'>;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'LOW_STOCK', label: STOCK_STATUS_LABELS.LOW_STOCK },
  { value: 'OUT_OF_STOCK', label: STOCK_STATUS_LABELS.OUT_OF_STOCK },
];

export default function InventoryPage() {
  const [summary, setSummary] = useState<InventorySummaryDto | null>(null);
  const [items, setItems] = useState<InventoryItemDto[] | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setItems(null);

    const query = new URLSearchParams({ pageSize: '100' });

    if (filter !== 'ALL') {
      query.set('status', filter);
    }

    try {
      const [summaryResponse, listResponse] = await Promise.all([
        apiClient.get<InventorySummaryDto>('/inventory/summary'),
        apiClient.get<Paginated<InventoryItemDto>>(`/inventory?${query.toString()}`),
      ]);

      setSummary(summaryResponse);
      setItems(listResponse.data);
    } catch {
      setFailed(true);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Acompanhe saldos, movimentacoes e itens que precisam de atencao."
        actions={
          <Button asChild variant="secondary">
            <Link href="/inventory/counts">
              <ClipboardList className="size-4" />
              Inventarios
            </Link>
          </Button>
        }
      />

      {failed ? (
        <ErrorState
          description="Nao conseguimos carregar o estoque."
          action={
            <Button type="button" onClick={() => void load()}>
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Produtos controlados" value={summary?.trackedProducts} />
            <SummaryCard label="Estoque baixo" value={summary?.lowStock} tone="warning" />
            <SummaryCard label="Sem estoque" value={summary?.outOfStock} tone="danger" />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  filter === option.value
                    ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                    : 'border-line-strong bg-surface text-foreground-muted hover:bg-surface-muted',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {!items ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface">
                <EmptyState
                  icon={PackageSearch}
                  title={
                    filter === 'ALL'
                      ? 'Nenhum produto com controle de estoque'
                      : 'Nenhum produto neste filtro'
                  }
                  description={
                    filter === 'ALL'
                      ? 'Ative "Controlar estoque" no cadastro de um produto para acompanhar o saldo aqui.'
                      : 'Isso e uma boa noticia: nada precisando de atencao agora.'
                  }
                  action={
                    filter === 'ALL' ? (
                      <Button asChild>
                        <Link href="/products/new">Cadastrar produto</Link>
                      </Button>
                    ) : null
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                      <th className="px-5 py-3">Produto</th>
                      <th className="px-5 py-3">Categoria</th>
                      <th className="px-5 py-3 text-right">Saldo</th>
                      <th className="px-5 py-3 text-right">Minimo</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Ultima movimentacao</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line">
                    {items.map((item) => (
                      <tr key={item.productId} className="transition-colors hover:bg-surface-muted">
                        <td className="max-w-[260px] px-5 py-3">
                          <Link
                            href={productDetailRoute(item.productId)}
                            className="block truncate font-medium text-foreground"
                          >
                            {item.name}
                          </Link>
                          {item.sku ? (
                            <span className="text-xs text-foreground-subtle tabular">
                              {item.sku}
                            </span>
                          ) : null}
                        </td>

                        <td className="px-5 py-3 text-foreground-muted">
                          {item.categoryName ?? '—'}
                        </td>

                        <td className="px-5 py-3 text-right font-medium text-foreground tabular">
                          {formatStock(item.quantity, item.unit)}
                        </td>

                        <td className="px-5 py-3 text-right text-foreground-muted tabular">
                          {item.minimum === null ? '—' : formatStock(item.minimum, item.unit)}
                        </td>

                        <td className="px-5 py-3">
                          <StockBadge status={item.status} />
                        </td>

                        <td className="px-5 py-3 text-foreground-muted">
                          {formatDate(item.lastMovementAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | undefined;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-8 w-12" />
      ) : (
        <p
          className={cn(
            'mt-2 text-2xl font-semibold tabular',
            tone === 'warning' && value > 0 && 'text-warning',
            tone === 'danger' && value > 0 && 'text-danger',
            (tone === 'neutral' || value === 0) && 'text-foreground',
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}
