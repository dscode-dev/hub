'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import type { CategoryDto, Paginated } from '@hub/shared';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface CategoryPickerProps {
  value: string | null;
  onChange: (categoryId: string | null, categoryName: string | null) => void;
  id?: string;
}

/**
 * Combobox de categoria com criacao inline.
 *
 * Sem isso o usuario precisaria abandonar o cadastro do produto, ir ate
 * categorias, criar e voltar. Aqui ele digita o nome e cria na hora.
 */
export function CategoryPicker({ value, onChange, id }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiClient
      .get<Paginated<CategoryDto>>('/categories?pageSize=100')
      .then((result) => {
        if (!cancelled) {
          setCategories(result.data);
        }
      })
      .catch(() => {
        // Lista indisponivel nao pode travar o cadastro: categoria e opcional.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = useMemo(
    () => categories.find((category) => category.id === value) ?? null,
    [categories, value],
  );

  const filtered = useMemo(() => {
    const normalized = term.trim().toLowerCase();

    if (!normalized) {
      return categories;
    }

    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, term]);

  const exactMatch = filtered.some(
    (category) => category.name.toLowerCase() === term.trim().toLowerCase(),
  );

  const handleCreate = async () => {
    const name = term.trim();

    if (!name || creating) {
      return;
    }

    setCreating(true);

    try {
      const created = await apiClient.post<CategoryDto>('/categories', { name });
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id, created.name);
      setTerm('');
      setOpen(false);
    } catch {
      // Erro exibido pelo formulario ao salvar; aqui apenas nao selecionamos.
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm transition-colors focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
      >
        <span className={cn('truncate', selected ? 'text-foreground' : 'text-foreground-subtle')}>
          {selected ? selected.name : 'Sem categoria'}
        </span>
        <ChevronDown className="size-4 shrink-0 text-foreground-subtle" />
      </button>

      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg shadow-brand-950/5">
          <div className="border-b border-line p-2">
            <input
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar ou criar categoria"
              autoFocus
              className="h-8 w-full rounded-md border border-line bg-surface px-2 text-sm placeholder:text-foreground-subtle focus-visible:border-brand-600 focus-visible:outline-none"
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1" role="listbox">
            {loading ? (
              <p className="flex items-center gap-2 px-3 py-3 text-sm text-foreground-subtle">
                <Loader2 className="size-4 animate-spin" />
                Carregando...
              </p>
            ) : null}

            {!loading ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-foreground-muted hover:bg-surface-muted"
              >
                Sem categoria
                {value === null ? <Check className="size-4 text-brand-600" /> : null}
              </button>
            ) : null}

            {filtered.map((category) => (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={category.id === value}
                onClick={() => {
                  onChange(category.id, category.name);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted"
              >
                <span className="truncate">{category.name}</span>
                {category.id === value ? <Check className="size-4 text-brand-600" /> : null}
              </button>
            ))}

            {term.trim() && !exactMatch ? (
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Criar categoria &ldquo;{term.trim()}&rdquo;
              </button>
            ) : null}

            {!loading && filtered.length === 0 && !term.trim() ? (
              <p className="px-3 py-3 text-sm text-foreground-subtle">
                Nenhuma categoria ainda. Digite acima para criar a primeira.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
