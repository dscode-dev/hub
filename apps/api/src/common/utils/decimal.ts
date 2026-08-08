import { Prisma } from '@prisma/client';

/**
 * Decimal do Prisma serializa como objeto em JSON. Toda saida da API converte
 * para number para manter o contrato simples do lado do cliente.
 *
 * Valores monetarios de PME cabem com folga na precisao de double; se o produto
 * evoluir para volumes financeiros maiores, trocar por string no contrato.
 */
export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

export function requiredDecimalToNumber(value: Prisma.Decimal): number {
  return Number(value);
}

/**
 * Interpreta valores monetarios digitados por pessoas ou vindos de planilhas:
 * "1.234,56", "1234.56", "R$ 1.234,56" e "1234" viram 1234.56 / 1234.
 * Retorna null quando nao ha um numero reconhecivel.
 */
export function parseHumanNumber(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }

  const cleaned = input.replace(/[^\d,.-]/g, '').trim();

  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;
  if (lastComma > lastDot) {
    // formato pt-BR: separador decimal e a virgula
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // formato en-US ou sem separador de milhar
    normalized = cleaned.replace(/,/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
