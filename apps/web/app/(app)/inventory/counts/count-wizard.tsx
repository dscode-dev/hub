'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  CategoryDto,
  InventoryCountDto,
  InventoryCountScope,
  Paginated,
} from '@hub/shared';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, ApiError, type CountConflict } from '@/lib/api/client';
import { parseCurrencyInput } from '@/lib/format';
import { cn } from '@/lib/utils';

type Stage = 'scope' | 'counting' | 'review';

const SCOPES: { value: InventoryCountScope; label: string; description: string }[] = [
  {
    value: 'ALL',
    label: 'Todos os produtos',
    description: 'Conta tudo que tem controle de estoque.',
  },
  {
    value: 'CATEGORY',
    label: 'Por categoria',
    description: 'Util para contar uma secao por vez.',
  },
];

/**
 * Wizard de inventario fisico.
 *
 * Decisao de UX: a contagem NAO mostra o saldo do sistema (contagem cega).
 * Ver o numero esperado enquanto conta enviesa o resultado - a pessoa tende a
 * confirmar o que o sistema diz em vez de contar. A comparacao aparece so na
 * revisao, que e onde ela serve para decidir.
 */
export function CountWizard({
  countId,
  onExit,
}: {
  countId: string | null;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<Stage>(countId ? 'counting' : 'scope');
  const [count, setCount] = useState<InventoryCountDto | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [scope, setScope] = useState<InventoryCountScope>('ALL');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Itens que mudaram durante a contagem; vem do 409 da conclusao. */
  const [conflicts, setConflicts] = useState<CountConflict[]>([]);

  const loadCount = useCallback(async (id: string) => {
    try {
      const loaded = await apiClient.get<InventoryCountDto>(`/inventory/counts/${id}`);
      setCount(loaded);

      setCounted(
        Object.fromEntries(
          (loaded.items ?? []).map((item) => [
            item.productId,
            item.counted === null ? '' : String(item.counted),
          ]),
        ),
      );

      setStage(loaded.status === 'COMPLETED' ? 'review' : 'counting');
    } catch {
      setError('Nao conseguimos carregar este inventario.');
    }
  }, []);

  useEffect(() => {
    if (countId) {
      void loadCount(countId);
      return;
    }

    apiClient
      .get<Paginated<CategoryDto>>('/categories?pageSize=100')
      .then((response) => setCategories(response.data))
      .catch(() => undefined);
  }, [countId, loadCount]);

  const start = async () => {
    setBusy(true);
    setError(null);

    try {
      const created = await apiClient.post<InventoryCountDto>('/inventory/counts', {
        scope,
        categoryId: scope === 'CATEGORY' ? categoryId : null,
      });

      setCount(created);
      setCounted(Object.fromEntries((created.items ?? []).map((item) => [item.productId, ''])));
      setStage('counting');
    } catch (startError) {
      setError(
        startError instanceof ApiError ? startError.message : 'Nao conseguimos abrir o inventario.',
      );
    } finally {
      setBusy(false);
    }
  };

  const saveAndReview = async () => {
    if (!count) {
      return;
    }

    setBusy(true);
    setError(null);

    const items = Object.entries(counted)
      .map(([productId, raw]) => ({
        productId,
        counted: raw.trim() ? parseCurrencyInput(raw) : null,
      }))
      .filter((item) => item.counted !== null);

    if (items.length === 0) {
      setError('Informe a quantidade de ao menos um produto.');
      setBusy(false);
      return;
    }

    try {
      const updated = await apiClient.patch<InventoryCountDto>(
        `/inventory/counts/${count.id}/items`,
        { items },
      );

      setCount(updated);
      setStage('review');
    } catch (saveError) {
      setError(
        saveError instanceof ApiError ? saveError.message : 'Nao conseguimos salvar a contagem.',
      );
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!count) {
      return;
    }

    setBusy(true);
    setError(null);
    setConflicts([]);

    try {
      const completed = await apiClient.post<InventoryCountDto>(
        `/inventory/counts/${count.id}/complete`,
      );

      setCount(completed);
      toast.success('Inventario concluido. Os ajustes foram aplicados ao estoque.');
      onExit();
    } catch (completeError) {
      setError(
        completeError instanceof ApiError
          ? completeError.message
          : 'Nao conseguimos concluir o inventario.',
      );

      // Conflito: nomeia os itens que sairam do lugar e recarrega a tabela.
      // Sem a lista, "algo mudou" obrigaria a recontar tudo para achar o item.
      if (completeError instanceof ApiError && completeError.status === 409) {
        setConflicts(completeError.conflicts);
        void loadCount(count.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const items = count?.items ?? [];
  const withDifference = items.filter(
    (item) => item.counted !== null && item.difference !== null && item.difference !== 0,
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <button
        type="button"
        onClick={onExit}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Inventarios
      </button>

      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {stage === 'scope'
          ? 'O que voce quer contar?'
          : stage === 'counting'
            ? 'Contagem fisica'
            : 'Revisao'}
      </h1>
      <p className="mt-1 text-sm text-foreground-muted">
        {stage === 'scope'
          ? 'Escolha o alcance do inventario.'
          : stage === 'counting'
            ? 'Informe a quantidade encontrada em cada item.'
            : 'Confira as diferencas antes de aplicar os ajustes.'}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
        >
          {error}

          {conflicts.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 font-normal">
              {conflicts.map((conflict) => (
                <li key={conflict.productId}>
                  {conflict.productName}: era {conflict.expected}, agora e {conflict.current}
                </li>
              ))}
            </ul>
          ) : null}
        </p>
      ) : null}

      {stage === 'scope' ? (
        <div className="mt-6 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                aria-pressed={scope === option.value}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  scope === option.value
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-line hover:bg-surface-muted',
                )}
              >
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="mt-0.5 block text-xs text-foreground-muted">
                  {option.description}
                </span>
              </button>
            ))}
          </div>

          {scope === 'CATEGORY' ? (
            <Field label="Categoria" htmlFor="count-category">
              <select
                id="count-category"
                value={categoryId ?? ''}
                onChange={(event) => setCategoryId(event.target.value || null)}
                className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus-visible:border-brand-600 focus-visible:outline-none"
              >
                <option value="">Selecione</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void start()}
              disabled={busy || (scope === 'CATEGORY' && !categoryId)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Comecar contagem
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'counting' ? (
        !count ? (
          <Skeleton className="mt-6 h-64 rounded-xl" />
        ) : (
          <div className="mt-6">
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                    <th className="px-5 py-3">Produto</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3 text-right">Quantidade contada</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-2.5 text-foreground">{item.productName}</td>
                      <td className="px-5 py-2.5 text-foreground-muted tabular">
                        {item.sku ?? '—'}
                      </td>
                      <td className="px-5 py-2 text-right">
                        <Input
                          value={counted[item.productId] ?? ''}
                          onChange={(event) =>
                            setCounted((current) => ({
                              ...current,
                              [item.productId]: event.target.value,
                            }))
                          }
                          placeholder="—"
                          inputMode="decimal"
                          className="ml-auto h-9 w-28 text-right tabular"
                          aria-label={`Quantidade contada de ${item.productName}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={() => void saveAndReview()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Revisar diferencas
              </Button>
            </div>
          </div>
        )
      ) : null}

      {stage === 'review' && count ? (
        <div className="mt-6">
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-right">Sistema</th>
                  <th className="px-5 py-3 text-right">Contado</th>
                  <th className="px-5 py-3 text-right">Diferenca</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {items
                  .filter((item) => item.counted !== null)
                  .map((item) => (
                    <tr key={item.id} className={item.conflict ? 'bg-danger-surface/30' : ''}>
                      <td className="px-5 py-2.5 text-foreground">
                        {item.productName}
                        {item.conflict ? (
                          <span className="ml-2 text-xs font-medium text-danger">
                            estoque mudou durante a contagem
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-2.5 text-right text-foreground-muted tabular">
                        {item.expected}
                      </td>
                      <td className="px-5 py-2.5 text-right text-foreground tabular">
                        {item.counted}
                      </td>
                      <td
                        className={cn(
                          'px-5 py-2.5 text-right font-medium tabular',
                          (item.difference ?? 0) > 0 && 'text-success',
                          (item.difference ?? 0) < 0 && 'text-danger',
                          (item.difference ?? 0) === 0 && 'text-foreground-subtle',
                        )}
                      >
                        {(item.difference ?? 0) > 0 ? '+' : ''}
                        {item.difference}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {count.status === 'COMPLETED' ? (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-success-surface px-3 py-2 text-sm text-success">
              <Check className="size-4" />
              Inventario concluido. Os ajustes ja foram aplicados.
            </p>
          ) : (
            <>
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-px size-4 shrink-0" />
                Ao concluir, as {withDifference.length} diferenca(s) gerarao movimentacoes de ajuste
                no estoque. O historico registra a origem como inventario.
              </p>

              <div className="mt-4 flex justify-between">
                <Button type="button" variant="ghost" onClick={() => setStage('counting')}>
                  Voltar a contagem
                </Button>

                <Button type="button" onClick={() => void complete()} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Concluir inventario
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {stage === 'review' && !count ? <ErrorState /> : null}
    </div>
  );
}
