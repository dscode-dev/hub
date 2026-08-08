const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const quantityFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return currencyFormatter.format(value);
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return quantityFormatter.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return dateFormatter.format(new Date(value));
}

/**
 * Converte o que o usuario digitou em numero.
 * Aceita "1.299,90", "1299.90" e "R$ 1.299,90" - digitar preco nao deveria
 * exigir que a pessoa acerte o formato.
 */
export function parseCurrencyInput(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim();

  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  const normalized =
    lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/** Iniciais para avatares e placeholders. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
