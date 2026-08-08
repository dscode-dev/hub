'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ProductDto } from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { ProductActions } from './product-actions';

/**
 * Detalhe do produto.
 *
 * Rota migrada de `/products/[id]` para `/products/detail?id=...`.
 * Static export exige `generateStaticParams` para rotas dinamicas, e os ids so
 * existem em runtime - nao ha como pre-renderizar. Query param resolve isso sem
 * abrir mao de link direto, refresh e navegacao para tras.
 */
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

  const load = useCallback(async () => {
    if (!id) {
      setState('not-found');
      return;
    }

    setState('loading');

    try {
      setProduct(await apiClient.get<ProductDto>(`/products/${id}`));
      setState('ready');
    } catch (error) {
      // 404 tambem cobre produto de outro tenant: nao revelamos que ele existe.
      setState(error instanceof ApiError && error.isNotFound ? 'not-found' : 'error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div className="mx-auto w-full max-w-3xl">
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
          </div>

          <p className="mt-1 text-sm text-foreground-muted">
            {product.category?.name ?? 'Sem categoria'}
            {product.sku ? ` · ${product.sku}` : ''}
          </p>
        </div>

        <ProductActions product={product} onChanged={() => void load()} />
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="Preco de venda" value={formatCurrency(product.salePrice)} highlight />
        <InfoCard label="Preco de custo" value={formatCurrency(product.costPrice)} />

        <InfoCard
          label="Estoque"
          value={product.trackInventory ? formatQuantity(product.stockQuantity) : 'Nao controlado'}
          hint={
            product.trackInventory && product.minStockQuantity !== null
              ? `Minimo: ${formatQuantity(product.minStockQuantity)}`
              : undefined
          }
        />

        <InfoCard label="Codigo de barras" value={product.barcode ?? '—'} />
      </section>

      {product.description ? (
        <section className="mt-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-foreground">Descricao</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground-muted">
            {product.description}
          </p>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-foreground-subtle">
        Criado em {formatDate(product.createdAt)} · Atualizado em {formatDate(product.updatedAt)}
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-40" />

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
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
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
      {hint ? <p className="mt-1 text-xs text-foreground-subtle">{hint}</p> : null}
    </div>
  );
}
