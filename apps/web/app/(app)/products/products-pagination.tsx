'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Paginated, ProductDto } from '@hub/shared';
import { Button } from '@/components/ui/button';
import { routeWithQuery } from '@/lib/routes';

export function ProductsPagination({ meta }: { meta: Paginated<ProductDto>['meta'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (meta.totalPages <= 1) {
    return (
      <p className="text-xs text-foreground-subtle">
        {meta.total} {meta.total === 1 ? 'produto' : 'produtos'}
      </p>
    );
  }

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(routeWithQuery(pathname, params));
  };

  const firstItem = (meta.page - 1) * meta.pageSize + 1;
  const lastItem = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-foreground-subtle tabular">
        {firstItem}–{lastItem} de {meta.total} produtos
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => goToPage(meta.page - 1)}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>

        <span className="text-xs text-foreground-muted tabular">
          {meta.page} de {meta.totalPages}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => goToPage(meta.page + 1)}
        >
          Proxima
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
