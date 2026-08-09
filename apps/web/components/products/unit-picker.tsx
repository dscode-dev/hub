'use client';

import { useEffect, useState } from 'react';
import type { UnitOfMeasureDto } from '@hub/shared';
import { apiClient } from '@/lib/api/client';

/** Codigo da unidade escolhida por padrao no cadastro. */
const DEFAULT_UNIT_CODE = 'UN';

/**
 * Seletor de unidade de medida.
 *
 * O usuario ve "Unidade", "Quilograma" - nunca `milli`. Seleciona a unidade
 * padrao automaticamente para que o cadastro rapido nao exija mais uma escolha.
 */
export function UnitPicker({
  value,
  onChange,
  id,
}: {
  value: string | null;
  onChange: (unitId: string | null) => void;
  id?: string;
}) {
  const [units, setUnits] = useState<UnitOfMeasureDto[]>([]);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<{ data: UnitOfMeasureDto[] }>('/units')
      .then((response) => {
        if (cancelled) {
          return;
        }

        setUnits(response.data);

        // Default inteligente: a maioria dos produtos e vendida por unidade.
        if (!value) {
          const fallback = response.data.find((unit) => unit.code === DEFAULT_UNIT_CODE);

          if (fallback) {
            onChange(fallback.id);
          }
        }
      })
      .catch(() => {
        // Unidade e opcional: falha ao listar nao pode travar o cadastro.
      });

    return () => {
      cancelled = true;
    };
    // Executa uma vez: recarregar a lista a cada mudanca de valor nao faz sentido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
    >
      <option value="">Sem unidade</option>
      {units.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.name} ({unit.symbol})
        </option>
      ))}
    </select>
  );
}
