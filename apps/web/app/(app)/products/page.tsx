'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { PackagePlus, Upload } from 'lucide-react';
import type { Paginated, ProductDto } from '@hub/shared';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ProductFilters } from './product-filters';
import { ProductListSkeleton } from './product-list-skeleton';
import { ProductsTable } from './products-table';

export default function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Tudo o que voce vende, em um catalogo unico."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/products/import">
                <Upload className="size-4" />
                Importar CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <PackagePlus className="size-4" />
                Novo produto
              </Link>
            </Button>
          </>
        }
      />

      {/* useSearchParams exige boundary de Suspense no static export. */}
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductsContent />
      </Suspense>
    </div>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const page = searchParams.get('page') ?? '1';
  const showingInactive = searchParams.get('active') === 'false';

  const [result, setResult] = useState<Paginated<ProductDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    const query = new URLSearchParams({
      page,
      pageSize: '20',
      active: showingInactive ? 'false' : 'true',
    });

    if (search) {
      query.set('search', search);
    }

    try {
      setResult(await apiClient.get<Paginated<ProductDto>>(`/products?${query.toString()}`));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, showingInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <ProductFilters />

      {failed ? (
        <ErrorState
          description="Nao conseguimos carregar seus produtos agora."
          action={
            <Button type="button" onClick={() => void load()}>
              Tentar novamente
            </Button>
          }
        />
      ) : loading || !result ? (
        <ProductListSkeleton />
      ) : (
        <ProductsTable
          products={result.data}
          meta={result.meta}
          search={search}
          showingInactive={showingInactive}
        />
      )}
    </>
  );
}
