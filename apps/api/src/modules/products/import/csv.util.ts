import { parse } from 'csv-parse/sync';
import { BadRequestException } from '@nestjs/common';

export interface ParsedCsv {
  columns: string[];
  rows: Record<string, string>[];
}

/**
 * Planilhas de PME quase nunca vem em UTF-8 limpo com virgula.
 * Aqui tratamos os dois problemas classicos antes de parsear:
 * encoding (Excel exporta em Windows-1252) e delimitador (pt-BR usa ";").
 */
export function decodeCsvBuffer(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [';', ',', '\t', '|'];

  let best = ',';
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

export function parseCsv(content: string): ParsedCsv {
  const delimiter = detectDelimiter(content);

  let records: Record<string, string>[];
  try {
    records = parse(content, {
      delimiter,
      columns: (header: string[]) => header.map((name, index) => name.trim() || `Coluna ${index + 1}`),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (error) {
    throw new BadRequestException(
      `Nao foi possivel ler o arquivo CSV: ${error instanceof Error ? error.message : 'formato invalido'}`,
    );
  }

  if (records.length === 0) {
    throw new BadRequestException('O arquivo nao possui linhas de dados');
  }

  const columns = Object.keys(records[0] ?? {});

  if (columns.length === 0) {
    throw new BadRequestException('O arquivo nao possui colunas reconheciveis');
  }

  return { columns, rows: records };
}

/** Normaliza cabecalhos para comparacao: sem acento, sem pontuacao, minusculo. */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
