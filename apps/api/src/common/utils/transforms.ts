import type { TransformFnParams } from 'class-transformer';

/**
 * Transformadores reutilizados pelos DTOs.
 *
 * `TransformFnParams.value` e `any`; cada helper reduz para `unknown` logo na
 * entrada para que nenhum `any` escape para o resto do codebase.
 */

/** Remove espacos das pontas, preservando string vazia. */
export function trimString({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim() : input;
}

/** Remove espacos e converte string vazia em null (campo opcional limpo). */
export function trimToNull({ value }: TransformFnParams): unknown {
  const input: unknown = value;

  if (typeof input !== 'string') {
    return input;
  }

  return input.trim() || null;
}

/** Normaliza e-mail para comparacao case-insensitive. */
export function normalizeEmail({ value }: TransformFnParams): unknown {
  const input: unknown = value;
  return typeof input === 'string' ? input.trim().toLowerCase() : input;
}

/** Converte para numero; string vazia e null viram `undefined` (campo ausente). */
export function toOptionalNumber({ value }: TransformFnParams): unknown {
  const input: unknown = value;

  if (input === '' || input === null || input === undefined) {
    return undefined;
  }

  return Number(input);
}

/** Converte para numero mantendo null explicito (para limpar o campo). */
export function toNullableNumber({ value }: TransformFnParams): unknown {
  const input: unknown = value;

  if (input === '' || input === null) {
    return null;
  }

  if (input === undefined) {
    return undefined;
  }

  return Number(input);
}

/** Query strings chegam como "true"/"false"; converte para boolean real. */
export function toBooleanFromQuery({ value }: TransformFnParams): unknown {
  const input: unknown = value;

  if (input === 'true') {
    return true;
  }

  if (input === 'false') {
    return false;
  }

  return input;
}

/** Aplica um valor padrao quando a query nao traz o parametro. */
export function withDefaultNumber(fallback: number) {
  return ({ value }: TransformFnParams): unknown => {
    const input: unknown = value;

    if (input === undefined || input === '' || input === null) {
      return fallback;
    }

    return Number(input);
  };
}
