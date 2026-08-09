'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  INVENTORY_MOVEMENT_LABELS,
  type InventoryMovementDto,
  type Paginated,
  type ProductDto,
} from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { formatSignedStock, formatStock } from '@/lib/inventory/format';
import { cn } from '@/lib/utils';

/**
 * Extrato do produto.
 *
 * Responde "por que o saldo e esse": cada linha traz o que aconteceu, quanto
 * mudou e em quanto o saldo ficou. O "saldo apos" vem gravado no movimento,
 * entao a coluna e historicamente fiel e nao um acumulado recalculado.
 */
export function ProductMovements({ product, refreshKey }: { product: ProductDto; refreshKey: number }) {
  const [movements, setMovements] = useState<InventoryMovementDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);

    try {
      const response = await apiClient.get<Paginated<InventoryMovementDto>>(
        `/inventory/products/${product.id}/movements?pageSize=50`,
      );

      setMovements(response.data);
    } catch {
      setFailed(true);
    }
  }, [product.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (failed) {
    return (
      <ErrorState
        description="Nao conseguimos carregar o historico."
        action={
          <Button type="button" onClick={() => void load()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (!movements) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <EmptyState
        title="Nenhuma movimentacao ainda"
        description={
          product.trackInventory
            ? 'Registre uma entrada ou saida para comecar o historico.'
            : 'Este produto nao controla estoque.'
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <th className="px-5 py-3">Data</th>
            <th className="px-5 py-3">Tipo</th>
            <th className="px-5 py-3 text-right">Quantidade</th>
            <th className="px-5 py-3 text-right">Saldo apos</th>
            <th className="px-5 py-3">Responsavel</th>
            <th className="px-5 py-3">Motivo</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {movements.map((movement) => {
            const inbound = movement.quantity > 0;

            return (
              <tr key={movement.id}>
                <td className="whitespace-nowrap px-5 py-3 text-foreground-muted">
                  {formatDate(movement.createdAt)}
                </td>

                <td className="px-5 py-3">
                  <span className="flex items-center gap-1.5 text-foreground">
                    {/* Sinal por icone, nao so por cor: leitura acessivel. */}
                    {inbound ? (
                      <ArrowUpRight className="size-3.5 text-success" />
                    ) : (
                      <ArrowDownLeft className="size-3.5 text-danger" />
                    )}
                    {INVENTORY_MOVEMENT_LABELS[movement.type]}
                  </span>
                </td>

                <td
                  className={cn(
                    'px-5 py-3 text-right font-medium tabular',
                    inbound ? 'text-success' : 'text-danger',
                  )}
                >
                  {formatSignedStock(movement.quantity, product.unit)}
                </td>

                <td className="px-5 py-3 text-right text-foreground tabular">
                  {formatStock(movement.balanceAfter, product.unit)}
                </td>

                <td className="px-5 py-3 text-foreground-muted">
                  {movement.createdByName ?? '—'}
                </td>

                <td className="max-w-[220px] truncate px-5 py-3 text-foreground-muted">
                  {movement.reason ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
