'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import type { ProductDto } from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { StockAdjustDialog } from '@/components/inventory/stock-adjust-dialog';
import { StockBadge } from '@/components/inventory/stock-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { formatCurrency, formatDate } from '@/lib/format';
import { formatStock } from '@/lib/inventory/format';
import { cn } from '@/lib/utils';
import { ProductActions } from './product-actions';
import { ProductMovements } from './product-movements';

type Tab = 'summary' | 'inventory' | 'movements';

const TABS: { value: Tab; label: string }[] = [
  { value: 'summary', label: 'Resumo' },
  { value: 'inventory', label: 'Estoque' },
  { value: 'movements', label: 'Movimentacoes' },
];

/** Migrada de `/products/[id]` para `/products/detail?id=...` (static export). */
export default function ProductDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ProductDetailContent />
    </Suspense>
  );
}

function ProductDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('summary');
  const [adjusting, setAdjusting] = useState(false);
  /** Muda a cada movimentacao para o extrato recarregar sem reload da pagina. */
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) {
      setState('not-found');
      return;
    }

    try {
      setProduct(await apiClient.get<ProductDto>(`/products/${id}`));
      setState('ready');
    } catch (error) {
      setState(error instanceof ApiError && error.isNotFound ? 'not-found' : 'error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMovement = () => {
    setRefreshKey((key) => key + 1);
    void load();
  };

  if (state === 'loading') {
    return <DetailSkeleton />;
  }

  if (state === 'not-found') {
    return (
      <EmptyState
        title="Produto nao encontrado"
        description="Ele pode ter sido removido ou o endereco esta incorreto."
        action={
          <Button asChild>
            <Link href="/products">Voltar para produtos</Link>
          </Button>
        }
      />
    );
  }

  if (state === 'error' || !product) {
    return (
      <ErrorState
        description="Nao conseguimos carregar este produto."
        action={
          <Button type="button" onClick={() => void load()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Produtos
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {product.name}
            </h1>
            {product.active ? null : <Badge variant="neutral">Removido</Badge>}
            <StockBadge status={product.inventory.status} />
          </div>

          <p className="mt-1 text-sm text-foreground-muted">
            {product.category?.name ?? 'Sem categoria'}
            {product.sku ? ` · ${product.sku}` : ''}
          </p>
        </div>

        <ProductActions product={product} onChanged={() => void load()} />
      </div>

      <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Secoes do produto">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            aria-current={tab === item.value ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors',
              tab === item.value
                ? 'border-brand-600 font-medium text-brand-700'
                : 'border-transparent text-foreground-muted hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'summary' ? (
          <section className="grid gap-4 sm:grid-cols-2">
            <InfoCard label="Preco de venda" value={formatCurrency(product.salePrice)} highlight />
            <InfoCard label="Preco de custo" value={formatCurrency(product.costPrice)} />
            <InfoCard label="Unidade" value={product.unit ? product.unit.name : '—'} />
            <InfoCard label="Codigo de barras" value={product.barcode ?? '—'} />

            {product.description ? (
              <div className="rounded-xl border border-line bg-surface p-5 sm:col-span-2">
                <h2 className="text-sm font-semibold text-foreground">Descricao</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground-muted">
                  {product.description}
                </p>
              </div>
            ) : null}

            <p className="text-xs text-foreground-subtle sm:col-span-2">
              Criado em {formatDate(product.createdAt)} · Atualizado em{' '}
              {formatDate(product.updatedAt)}
            </p>
          </section>
        ) : null}

        {tab === 'inventory' ? (
          <section>
            {product.trackInventory ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <InfoCard
                    label="Saldo atual"
                    value={formatStock(product.inventory.quantity, product.unit)}
                    highlight
                  />
                  <InfoCard
                    label="Estoque minimo"
                    value={
                      product.inventory.minimum === null
                        ? '—'
                        : formatStock(product.inventory.minimum, product.unit)
                    }
                  />
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                      Status
                    </p>
                    <div className="mt-2">
                      <StockBadge status={product.inventory.status} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setAdjusting(true)}>
                    <SlidersHorizontal className="size-4" />
                    Ajustar estoque
                  </Button>
                </div>

                <p className="mt-4 text-xs text-foreground-subtle">
                  O saldo e resultado das movimentacoes registradas. Para altera-lo, registre uma
                  entrada ou saida - assim o historico continua explicando o numero.
                </p>
              </>
            ) : (
              <EmptyState
                title="Este produto nao controla estoque"
                description="Serviços e taxas normalmente nao precisam de controle. Ative na edicao do produto se quiser acompanhar o saldo."
                action={
                  <Button asChild variant="secondary">
                    <Link href={`/products/edit?id=${product.id}`}>Editar produto</Link>
                  </Button>
                }
              />
            )}
          </section>
        ) : null}

        {tab === 'movements' ? (
          <ProductMovements product={product} refreshKey={refreshKey} />
        ) : null}
      </div>

      <StockAdjustDialog
        product={product}
        open={adjusting}
        onOpenChange={setAdjusting}
        onCompleted={handleMovement}
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-6 h-10 w-full" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{label}</p>
      <p
        className={
          highlight
            ? 'mt-1.5 text-xl font-semibold text-foreground tabular'
            : 'mt-1.5 text-base text-foreground tabular'
        }
      >
        {value}
      </p>
    </div>
  );
}
