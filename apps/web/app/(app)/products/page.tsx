import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PackagePlus, Upload } from 'lucide-react';
import type { Paginated, ProductDto } from '@hub/shared';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { serverFetch } from '@/lib/api/server';
import { ProductFilters } from './product-filters';
import { ProductListSkeleton } from './product-list-skeleton';
import { ProductsTable } from './products-table';

export const metadata: Metadata = {
  title: 'Produtos',
};

interface SearchParams {
  search?: string;
  page?: string;
  active?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

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

      <ProductFilters />

      {/* A key faz o Suspense reabrir a cada mudanca de filtro, mostrando skeleton. */}
      <Suspense
        key={`${params.search ?? ''}-${params.page ?? '1'}-${params.active ?? 'true'}`}
        fallback={<ProductListSkeleton />}
      >
        <ProductsResult params={params} />
      </Suspense>
    </div>
  );
}

async function ProductsResult({ params }: { params: SearchParams }) {
  const query = new URLSearchParams({
    page: params.page ?? '1',
    pageSize: '20',
    active: params.active === 'false' ? 'false' : 'true',
  });

  if (params.search) {
    query.set('search', params.search);
  }

  try {
    const result = await serverFetch<Paginated<ProductDto>>(`/products?${query.toString()}`);

    return (
      <ProductsTable
        products={result.data}
        meta={result.meta}
        search={params.search ?? ''}
        showingInactive={params.active === 'false'}
      />
    );
  } catch {
    return (
      <ErrorState description="Nao conseguimos carregar seus produtos agora. Atualize a pagina para tentar de novo." />
    );
  }
}
