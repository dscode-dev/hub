'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

/**
 * Busca global. Neste passo ela resolve o unico dominio que existe (produtos);
 * quando houver clientes e vendas, o mesmo campo passa a consultar todos.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = term.trim();

    router.push(trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : '/products');
  };

  return (
    <form onSubmit={handleSubmit} className="relative hidden w-full max-w-md md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar produtos por nome, SKU ou codigo de barras"
        aria-label="Busca global"
        className="h-9 w-full rounded-lg border border-line bg-surface-muted pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-foreground-subtle focus-visible:border-brand-600 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
      />
    </form>
  );
}
