'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { CepLookupDto } from '@hub/shared';
import { Field } from '@/components/ui/field';
import { apiClient, ApiError } from '@/lib/api/client';
import { CheckedInput } from './checked-input';

export type ZipLookupState = 'idle' | 'searching' | 'found' | 'not-found' | 'offline';

/**
 * Campo de CEP com preenchimento automatico.
 *
 * Ao completar os 8 digitos, consulta e preenche rua, bairro, cidade e UF.
 * Sobram para a pessoa apenas os dados que nenhum servico sabe: numero,
 * complemento e ponto de referencia.
 *
 * Sem internet nada trava: avisamos por notificacao e os campos ficam
 * editaveis. A aplicacao e local-first - consulta de CEP e conveniencia.
 */
export function ZipCodeField({
  value,
  onChange,
  onResolved,
  onStateChange,
  state,
}: {
  value: string;
  onChange: (zipCode: string) => void;
  onResolved: (address: CepLookupDto) => void;
  onStateChange: (state: ZipLookupState) => void;
  state: ZipLookupState;
}) {
  const [touched, setTouched] = useState(false);
  /** Evita repetir a consulta do mesmo CEP a cada re-render. */
  const lastQueried = useRef<string | null>(null);

  const digits = value.replace(/\D/g, '');
  const complete = digits.length === 8;

  useEffect(() => {
    if (!complete || lastQueried.current === digits) {
      return;
    }

    lastQueried.current = digits;
    let cancelled = false;

    const lookup = async () => {
      onStateChange('searching');

      try {
        const address = await apiClient.get<CepLookupDto>(`/address/cep/${digits}`);

        if (cancelled) {
          return;
        }

        onResolved(address);
        onStateChange('found');
      } catch (error) {
        if (cancelled) {
          return;
        }

        // 404: CEP nao existe. Qualquer outra falha tratamos como "sem rede",
        // porque o resultado pratico para o usuario e o mesmo: preencher a mao.
        const notFound = error instanceof ApiError && error.status === 404;

        onStateChange(notFound ? 'not-found' : 'offline');

        toast(notFound ? 'CEP nao encontrado' : 'Nao conseguimos consultar o CEP', {
          description: notFound
            ? 'Confira o numero ou preencha o endereco manualmente.'
            : 'Sem conexao no momento. Pode preencher o endereco manualmente.',
        });
      }
    };

    void lookup();

    return () => {
      cancelled = true;
    };
  }, [complete, digits, onResolved, onStateChange]);

  const handleChange = (raw: string) => {
    const nextDigits = raw.replace(/\D/g, '').slice(0, 8);

    // Editar o CEP invalida a busca anterior e permite consultar de novo.
    if (nextDigits !== digits) {
      lastQueried.current = null;
      onStateChange('idle');
    }

    onChange(formatZip(nextDigits));
  };

  const hint =
    state === 'searching'
      ? 'Buscando endereco...'
      : state === 'found'
        ? 'Endereco preenchido automaticamente.'
        : state === 'not-found'
          ? 'CEP nao encontrado. Preencha manualmente.'
          : state === 'offline'
            ? 'Sem conexao. Preencha o endereco manualmente.'
            : 'Preenchemos rua, bairro, cidade e UF para voce.';

  return (
    <Field
      label="CEP"
      htmlFor="zip"
      optional
      hint={hint}
      error={touched && digits.length > 0 && !complete ? 'O CEP tem 8 digitos.' : undefined}
    >
      <div className="relative">
        <CheckedInput
          id="zip"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="00000-000"
          inputMode="numeric"
          autoComplete="postal-code"
          className="tabular pl-9"
          valid={state === 'found'}
          autoFocus
        />

        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle">
          {state === 'searching' ? (
            <Loader2 className="size-4 animate-spin text-brand-600" />
          ) : (
            <Search className="size-4" />
          )}
        </span>
      </div>
    </Field>
  );
}

function formatZip(digits: string): string {
  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
