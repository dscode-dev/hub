import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ImportCommitResponseDto,
  ImportFieldMapping,
  ImportPreviewResponseDto,
  ImportPreviewRow,
  ImportRowError,
  ImportUploadResponseDto,
  ImportableProductField,
} from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { parseHumanNumber } from '@/common/utils/decimal';
import { AuditService } from '@/modules/audit/audit.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { decodeCsvBuffer, normalizeHeader, parseCsv } from './csv.util';
import type { ImportFieldMappingDto } from './dto/import-mapping.dto';

/** Sinonimos usados para sugerir o mapeamento automatico das colunas. */
const HEADER_SYNONYMS: Record<ImportableProductField, string[]> = {
  name: ['nome', 'nomedoproduto', 'produto', 'descricao', 'item', 'name', 'title'],
  salePrice: ['preco', 'precodevenda', 'valor', 'valorvenda', 'venda', 'price', 'saleprice'],
  sku: ['sku', 'codigo', 'codigointerno', 'referencia', 'ref', 'code'],
  categoryName: ['categoria', 'grupo', 'segmento', 'category', 'departamento'],
  stockQuantity: ['quantidade', 'qtd', 'qtde', 'estoque', 'saldo', 'quantity', 'stock'],
  costPrice: ['custo', 'precodecusto', 'valorcusto', 'cost', 'costprice'],
  barcode: ['codigodebarras', 'ean', 'gtin', 'barcode', 'codbarras'],
};

const MAX_PREVIEW_ROWS = 50;
const MAX_IMPORT_ROWS = 5000;

@Injectable()
export class ProductImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly auditService: AuditService,
  ) {}

  /** Etapa 1 e 2: recebe o arquivo, le as colunas e sugere o mapeamento. */
  async upload(
    user: AuthenticatedUser,
    file: { originalname: string; buffer: Buffer },
  ): Promise<ImportUploadResponseDto> {
    const content = decodeCsvBuffer(file.buffer);
    const { columns, rows } = parseCsv(content);

    if (rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `O arquivo tem ${rows.length} linhas. O limite atual e de ${MAX_IMPORT_ROWS} por importacao.`,
      );
    }

    const job = await this.prisma.importJob.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        filename: file.originalname,
        rawContent: content,
        columns,
        totalRows: rows.length,
      },
    });

    return {
      importId: job.id,
      filename: job.filename,
      columns,
      sampleRows: rows.slice(0, 5),
      totalRows: rows.length,
      suggestedMapping: suggestMapping(columns),
    };
  }

  /** Etapa 4: valida linha a linha sem gravar nada. */
  async preview(
    user: AuthenticatedUser,
    importId: string,
    mapping: ImportFieldMappingDto,
  ): Promise<ImportPreviewResponseDto> {
    const { rows } = await this.loadJobRows(user.organizationId, importId);
    const evaluated = rows.map((row, index) => this.evaluateRow(row, index, mapping));
    const validRows = evaluated.filter((row) => row.valid).length;

    return {
      importId,
      totalRows: evaluated.length,
      validRows,
      invalidRows: evaluated.length - validRows,
      // Linhas invalidas primeiro: e o que o usuario precisa revisar.
      rows: [...evaluated].sort((a, b) => Number(a.valid) - Number(b.valid)).slice(0, MAX_PREVIEW_ROWS),
    };
  }

  /**
   * Etapa 5: grava os produtos validos.
   * Uma linha invalida nao cancela o arquivo - ela e reportada e as demais seguem.
   */
  async commit(
    user: AuthenticatedUser,
    importId: string,
    mapping: ImportFieldMappingDto,
  ): Promise<ImportCommitResponseDto> {
    const organizationId = user.organizationId;
    const { rows } = await this.loadJobRows(organizationId, importId);

    const errors: ImportRowError[] = [];
    let createdRows = 0;

    // Cache de categorias por nome para nao consultar o banco a cada linha.
    const categoryCache = new Map<string, string>();
    // SKUs ja usados neste arquivo, para detectar duplicidade interna.
    const seenSkus = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const evaluated = this.evaluateRow(row, index, mapping);

      if (!evaluated.valid || evaluated.name === null || evaluated.salePrice === null) {
        errors.push({ line: evaluated.line, message: evaluated.errors.join(' ') });
        continue;
      }

      const sku = evaluated.sku;

      if (sku && seenSkus.has(sku.toLowerCase())) {
        errors.push({ line: evaluated.line, message: 'SKU repetido dentro do arquivo', value: sku });
        continue;
      }

      try {
        if (sku) {
          const duplicate = await this.prisma.product.findFirst({
            where: { organizationId, sku },
            select: { id: true },
          });

          if (duplicate) {
            errors.push({
              line: evaluated.line,
              message: 'Ja existe um produto cadastrado com esse SKU',
              value: sku,
            });
            continue;
          }
        }

        const categoryId = evaluated.categoryName
          ? await this.resolveCategory(organizationId, evaluated.categoryName, categoryCache)
          : null;

        const trackInventory = evaluated.stockQuantity !== null;

        await this.prisma.product.create({
          data: {
            organizationId,
            name: evaluated.name,
            salePrice: new Prisma.Decimal(evaluated.salePrice),
            sku,
            categoryId,
            trackInventory,
            stockQuantity: new Prisma.Decimal(evaluated.stockQuantity ?? 0),
          },
        });

        if (sku) {
          seenSkus.add(sku.toLowerCase());
        }
        createdRows += 1;
      } catch (error) {
        errors.push({
          line: evaluated.line,
          message: error instanceof Error ? error.message : 'Falha ao gravar a linha',
        });
      }
    }

    await this.prisma.importJob.update({
      where: { id: importId },
      data: {
        status: 'COMPLETED',
        fieldMapping: mapping as Prisma.InputJsonValue,
        createdRows,
        failedRows: errors.length,
        errors: errors as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_IMPORTED',
      entity: 'ImportJob',
      entityId: importId,
      metadata: { createdRows, failedRows: errors.length, totalRows: rows.length },
    });

    return {
      importId,
      totalRows: rows.length,
      createdRows,
      failedRows: errors.length,
      errors,
    };
  }

  private async resolveCategory(
    organizationId: string,
    name: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const key = name.toLowerCase();
    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const categoryId = await this.categoriesService.findOrCreateByName(organizationId, name);
    cache.set(key, categoryId);

    return categoryId;
  }

  private evaluateRow(
    row: Record<string, string>,
    index: number,
    mapping: ImportFieldMappingDto,
  ): ImportPreviewRow {
    // +2: linha 1 e o cabecalho e a contagem para o usuario comeca em 1.
    const line = index + 2;
    const errors: string[] = [];

    const rawName = readColumn(row, mapping.name);
    const name = rawName?.trim() || null;

    if (!name) {
      errors.push('Nome do produto e obrigatorio.');
    } else if (name.length > 200) {
      errors.push('Nome do produto excede 200 caracteres.');
    }

    const rawPrice = readColumn(row, mapping.salePrice);
    const salePrice = parseHumanNumber(rawPrice);

    if (salePrice === null) {
      errors.push('Preco de venda e obrigatorio e deve ser um numero.');
    } else if (salePrice < 0) {
      errors.push('Preco de venda nao pode ser negativo.');
    }

    const rawStock = readColumn(row, mapping.stockQuantity);
    const stockQuantity = rawStock ? parseHumanNumber(rawStock) : null;

    if (rawStock && stockQuantity === null) {
      errors.push('Quantidade em estoque nao e um numero valido.');
    }

    const sku = readColumn(row, mapping.sku)?.trim() || null;
    const categoryName = readColumn(row, mapping.categoryName)?.trim() || null;

    return {
      line,
      valid: errors.length === 0,
      name,
      sku,
      categoryName,
      salePrice: salePrice !== null && salePrice >= 0 ? salePrice : null,
      stockQuantity,
      errors,
    };
  }

  private async loadJobRows(organizationId: string, importId: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id: importId, organizationId },
    });

    if (!job) {
      throw new NotFoundException('Importacao nao encontrada');
    }

    if (job.status === 'COMPLETED') {
      throw new BadRequestException('Esta importacao ja foi concluida');
    }

    return parseCsv(job.rawContent);
  }
}

function readColumn(row: Record<string, string>, column?: string | null): string | undefined {
  if (!column) {
    return undefined;
  }

  return row[column];
}

/** Sugere um mapeamento inicial para o usuario apenas revisar, nao montar do zero. */
export function suggestMapping(columns: string[]): ImportFieldMapping {
  const normalized = columns.map((column) => ({ column, key: normalizeHeader(column) }));
  const used = new Set<string>();
  const mapping: ImportFieldMapping = {};

  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [
    ImportableProductField,
    string[],
  ][]) {
    const exact = normalized.find((item) => !used.has(item.column) && synonyms.includes(item.key));
    const partial =
      exact ??
      normalized.find(
        (item) =>
          !used.has(item.column) && synonyms.some((synonym) => item.key.includes(synonym)),
      );

    if (partial) {
      mapping[field] = partial.column;
      used.add(partial.column);
    }
  }

  return mapping;
}
