'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ProductDto } from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ProductForm } from '@/components/products/product-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { productDetailRoute } from '@/lib/routes';

/** Migrada de `/products/[id]/edit` para `/products/edit?id=...` (static export). */
export default function EditProductPage() {
  return (
    <Suspense fallback={<EditSkeleton />}>
      <EditProductContent />
    </Suspense>
  );
}

function EditProductContent() {
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
      setState(error instanceof ApiError && error.isNotFound ? 'not-found' : 'error');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return <EditSkeleton />;
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
        href={productDetailRoute(product.id)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {product.name}
      </Link>

      <h1 className="mb-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Editar produto
      </h1>

      <ProductForm mode="edit" product={product} />
    </div>
  );
}

function EditSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Skeleton className="mt-6 h-96 rounded-xl" />
    </div>
  );
}
