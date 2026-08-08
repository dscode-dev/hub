import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ProductDto } from '@hub/shared';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api/errors';
import { serverFetch } from '@/lib/api/server';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { ProductActions } from './product-actions';

export const metadata: Metadata = {
  title: 'Produto',
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: ProductDto;

  try {
    product = await serverFetch<ProductDto>(`/products/${id}`);
  } catch (error) {
    // 404 tambem cobre produto de outro tenant: nao revelamos que ele existe.
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }

    throw error;
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

        <ProductActions product={product} />
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard label="Preco de venda" value={formatCurrency(product.salePrice)} highlight />
        <InfoCard label="Preco de custo" value={formatCurrency(product.costPrice)} />

        <InfoCard
          label="Estoque"
          value={
            product.trackInventory
              ? formatQuantity(product.stockQuantity)
              : 'Nao controlado'
          }
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
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </p>
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
