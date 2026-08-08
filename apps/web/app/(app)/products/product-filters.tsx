'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { routeWithQuery } from '@/lib/routes';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

/**
 * Busca com debounce e filtro de status na URL.
 *
 * Manter o estado na URL permite recarregar, compartilhar e voltar sem perder
 * o que estava filtrado - detalhe que evita retrabalho para quem usa o dia todo.
 */
export function ProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get('search') ?? '';
  const showingInactive = searchParams.get('active') === 'false';

  const [term, setTerm] = useState(urlSearch);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);

  // Mantem o campo alinhado quando a navegacao vem de fora (busca global, voltar).
  useEffect(() => {
    setTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (term === urlSearch) {
      return;
    }

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (term.trim()) {
        params.set('search', term.trim());
      } else {
        params.delete('search');
      }

      params.delete('page');

      startTransition(() => {
        router.replace(routeWithQuery(pathname, params));
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [term, urlSearch, pathname, router, searchParams]);

  const toggleInactive = () => {
    const params = new URLSearchParams(searchParams.toString());

    if (showingInactive) {
      params.delete('active');
    } else {
      params.set('active', 'false');
    }

    params.delete('page');
    startTransition(() => {
      router.replace(routeWithQuery(pathname, params));
    });
  };

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-md">
        {isPending ? (
          <Loader2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-brand-600" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
        )}

        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar por nome, SKU ou codigo de barras"
          aria-label="Buscar produtos"
          className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-9 text-sm transition-colors placeholder:text-foreground-subtle focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
        />

        {term ? (
          <button
            type="button"
            onClick={() => setTerm('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-foreground-subtle transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={toggleInactive}
        aria-pressed={showingInactive}
        className={cn(
          'h-10 rounded-lg border px-3 text-sm transition-colors',
          showingInactive
            ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
            : 'border-line-strong bg-surface text-foreground-muted hover:bg-surface-muted',
        )}
      >
        {showingInactive ? 'Vendo removidos' : 'Ver removidos'}
      </button>
    </div>
  );
}
