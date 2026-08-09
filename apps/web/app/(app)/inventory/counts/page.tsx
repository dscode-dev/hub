'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus } from 'lucide-react';
import {
  INVENTORY_COUNT_STATUS_LABELS,
  type InventoryCountDto,
  type InventoryCountStatus,
} from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CountWizard } from './count-wizard';

const STATUS_STYLES: Record<InventoryCountStatus, string> = {
  DRAFT: 'bg-surface-muted text-foreground-subtle',
  IN_PROGRESS: 'bg-brand-50 text-brand-700',
  COMPLETED: 'bg-success-surface text-success',
  CANCELLED: 'bg-surface-muted text-foreground-subtle',
};

export default function InventoryCountsPage() {
  const [counts, setCounts] = useState<InventoryCountDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Contagem aberta no wizard; null mostra a lista. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);

    try {
      setCounts(await apiClient.get<InventoryCountDto[]>('/inventory/counts'));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (creating || activeId) {
    return (
      <CountWizard
        countId={activeId}
        onExit={() => {
          setCreating(false);
          setActiveId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div>
      <Link
        href="/inventory"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Estoque
      </Link>

      <PageHeader
        title="Inventarios"
        description="Compare o estoque do sistema com a contagem fisica e ajuste as diferencas."
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo inventario
          </Button>
        }
      />

      {failed ? (
        <ErrorState
          description="Nao conseguimos carregar os inventarios."
          action={
            <Button type="button" onClick={() => void load()}>
              Tentar novamente
            </Button>
          }
        />
      ) : !counts ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : counts.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={ClipboardList}
            title="Nenhum inventario ainda"
            description="Um inventario compara o que o sistema registra com o que existe na prateleira, e ajusta a diferenca."
            action={
              <Button type="button" onClick={() => setCreating(true)}>
                Comecar inventario
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {counts.map((count) => (
            <li key={count.id}>
              <button
                type="button"
                onClick={() => setActiveId(count.id)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-brand-300"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Inventario de {formatDate(count.createdAt)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        STATUS_STYLES[count.status],
                      )}
                    >
                      {INVENTORY_COUNT_STATUS_LABELS[count.status]}
                    </span>
                  </span>

                  <span className="mt-0.5 block text-xs text-foreground-subtle">
                    {count.countedItems} de {count.totalItems} itens contados
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
