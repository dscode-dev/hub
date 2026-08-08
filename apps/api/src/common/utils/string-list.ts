/**
 * Listas multivaloradas em SQLite.
 *
 * O conector nao suporta lista escalar, entao campos como `segments` e
 * `operationGoals` sao gravados como JSON em coluna de texto. A conversao fica
 * concentrada aqui: o dominio continua trabalhando com arrays tipados e nada
 * do formato de armazenamento vaza para service ou controller.
 */

export function serializeStringList(values: readonly string[] | null | undefined): string {
  return JSON.stringify(values ?? []);
}

/**
 * Le a lista de volta. Conteudo invalido devolve lista vazia em vez de quebrar:
 * um campo de personalizacao corrompido nao pode impedir o login.
 */
export function parseStringList<T extends string>(raw: string | null | undefined): T[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is T => typeof item === 'string');
  } catch {
    return [];
  }
}
