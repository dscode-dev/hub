/**
 * Conversao entre a unidade do dominio e a unidade de armazenamento.
 *
 * Por que inteiros: o SQLite nao tem tipo decimal real. Uma coluna DECIMAL cai
 * em afinidade NUMERIC e valores fracionarios sao gravados como ponto
 * flutuante - somar mil itens de 19,99 ja devolve 19990.000000000135. Num
 * sistema que fecha caixa, esse erro nao e aceitavel.
 *
 * Dinheiro trafega em reais na API e vive em CENTAVOS no banco.
 * Quantidades trafegam em unidades e vivem em MILESIMOS, o que preserva a
 * precisao de 3 casas do modelo anterior (kg, metro).
 */

const CENTS_PER_UNIT = 100;
const MILLI_PER_UNIT = 1000;

/**
 * Arredonda pelo caminho decimal antes de truncar.
 *
 * `1299.9 * 100` em ponto flutuante e 129989.99999999999; `Math.round` sozinho
 * ainda acerta aqui, mas nao em todos os casos. Normalizar via `toFixed` antes
 * remove a classe inteira de erro em vez de torcer para o valor ser benigno.
 */
function toScaledInteger(value: number, factor: number): number {
  return Math.round(Number((value * factor).toFixed(6)));
}

export function toCents(value: number): number {
  return toScaledInteger(value, CENTS_PER_UNIT);
}

export function fromCents(cents: number): number {
  return cents / CENTS_PER_UNIT;
}

export function toCentsOrNull(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : toCents(value);
}

export function fromCentsOrNull(cents: number | null | undefined): number | null {
  return cents === null || cents === undefined ? null : fromCents(cents);
}

export function toMilli(value: number): number {
  return toScaledInteger(value, MILLI_PER_UNIT);
}

export function fromMilli(milli: number): number {
  return milli / MILLI_PER_UNIT;
}

export function toMilliOrNull(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : toMilli(value);
}

export function fromMilliOrNull(milli: number | null | undefined): number | null {
  return milli === null || milli === undefined ? null : fromMilli(milli);
}
