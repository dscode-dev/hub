import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Paginated, ProductDto, StockStatus } from '@hub/shared';
import { paginate } from '@/common/dto/pagination-query.dto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { normalizeBarcode, normalizeCode, normalizeSearchText } from '@/common/utils/normalize';
import { toCents, toCentsOrNull, toMilli, toMilliOrNull } from '@/common/utils/money';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '@/modules/audit/audit.service';
import { InventoryLedgerService } from '@/modules/inventory/inventory-ledger.service';
import { DEFAULT_UNIT_ID } from '@/modules/units/default-unit';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto, ProductSortField } from './dto/list-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { productInclude, toProductDto } from './product.mapper';

/** Campo publico de ordenacao -> coluna real. */
const SORT_COLUMNS: Record<ProductSortField, 'searchName' | 'salePriceCents' | 'createdAt'> = {
  name: 'searchName',
  salePrice: 'salePriceCents',
  createdAt: 'createdAt',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async list(organizationId: string, query: ListProductsQueryDto): Promise<Paginated<ProductDto>> {
    const where = this.buildWhere(organizationId, query);

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { [SORT_COLUMNS[query.sortBy]]: query.sortOrder },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    const mapped = products.map(toProductDto);

    /*
     * Status depende de saldo + minimo, entao nao da para filtrar em SQL sem
     * duplicar a regra. Como a pagina ja veio limitada, filtrar aqui mantem
     * uma unica definicao de status (o mapper) sem custo relevante.
     */
    const filtered = query.stockStatus
      ? mapped.filter((product) => product.inventory.status === query.stockStatus)
      : mapped;

    return paginate(filtered, query.stockStatus ? filtered.length : total, query);
  }

  async findOne(organizationId: string, id: string): Promise<ProductDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado');
    }

    return toProductDto(product);
  }

  /**
   * Cria o produto e, quando ha estoque inicial, o movimento correspondente.
   *
   * Estoque inicial NAO vira campo do produto: vira o primeiro lancamento do
   * ledger. Tudo na mesma transacao - produto sem o movimento (ou o contrario)
   * deixaria o historico mentindo desde o primeiro dia.
   */
  async create(user: AuthenticatedUser, dto: CreateProductDto): Promise<ProductDto> {
    const organizationId = user.organizationId;

    await this.assertCategoryBelongsToOrg(organizationId, dto.categoryId);
    await this.assertUnitIsUsable(organizationId, dto.unitId);
    await this.assertCodesAreFree(organizationId, dto.sku, dto.barcode);

    const trackInventory = dto.trackInventory ?? false;
    const initialQuantity = trackInventory ? (dto.initialQuantity ?? 0) : 0;

    const productId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          organizationId,
          name: dto.name,
          searchName: normalizeSearchText(dto.name),
          salePriceCents: toCents(dto.salePrice),
          costPriceCents: toCentsOrNull(dto.costPrice),
          sku: dto.sku ?? null,
          skuNormalized: dto.sku ? normalizeCode(dto.sku) : null,
          barcode: dto.barcode ? normalizeBarcode(dto.barcode) : null,
          description: dto.description ?? null,
          categoryId: dto.categoryId ?? null,
          // Sem unidade escolhida, "UN": e o caso da esmagadora maioria dos
          // produtos e evita saldo sem unidade na tela e na conferencia.
          unitId: dto.unitId ?? DEFAULT_UNIT_ID,
          active: dto.active ?? true,
          trackInventory,
          minimumStockMilli: trackInventory ? toMilliOrNull(dto.minimumStock) : null,
        },
        select: { id: true },
      });

      if (trackInventory && initialQuantity > 0) {
        await this.ledger.record(
          {
            organizationId,
            productId: created.id,
            type: 'INITIAL_STOCK',
            quantityMilli: toMilli(initialQuantity),
            unitCostCents: toCentsOrNull(dto.costPrice),
            reason: 'Estoque inicial do cadastro',
            createdByUserId: user.id,
          },
          tx,
        );
      }

      return created.id;
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: productId,
      metadata: { name: dto.name, sku: dto.sku ?? null, initialQuantity },
    });

    return this.findOne(organizationId, productId);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProductDto): Promise<ProductDto> {
    const organizationId = user.organizationId;
    const current = await this.getOwnedOrFail(organizationId, id);

    await this.assertCategoryBelongsToOrg(organizationId, dto.categoryId);
    await this.assertUnitIsUsable(organizationId, dto.unitId);
    await this.assertCodesAreFree(organizationId, dto.sku, dto.barcode, id);

    const trackInventory = dto.trackInventory ?? current.trackInventory;

    await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        searchName: dto.name === undefined ? undefined : normalizeSearchText(dto.name),
        salePriceCents: dto.salePrice === undefined ? undefined : toCents(dto.salePrice),
        costPriceCents: dto.costPrice === undefined ? undefined : toCentsOrNull(dto.costPrice),
        sku: dto.sku,
        skuNormalized: dto.sku === undefined ? undefined : dto.sku ? normalizeCode(dto.sku) : null,
        barcode:
          dto.barcode === undefined ? undefined : dto.barcode ? normalizeBarcode(dto.barcode) : null,
        description: dto.description,
        categoryId: dto.categoryId,
        unitId: dto.unitId,
        active: dto.active,
        trackInventory: dto.trackInventory,
        // Desligar o controle limpa o minimo; o saldo permanece no ledger.
        minimumStockMilli: trackInventory ? toMilliOrNull(dto.minimumStock) : null,
      },
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: id,
      metadata: this.buildUpdateMetadata(current, dto),
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Soft delete: o produto e desativado, nunca removido.
   * O ledger dele continua intacto - historico nao se apaga.
   */
  async deactivate(user: AuthenticatedUser, id: string): Promise<ProductDto> {
    const organizationId = user.organizationId;
    const current = await this.getOwnedOrFail(organizationId, id);

    await this.prisma.product.update({ where: { id }, data: { active: false } });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_DEACTIVATED',
      entity: 'Product',
      entityId: id,
      metadata: { name: current.name },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Auditoria de alteracao.
   *
   * Preco muda de valor no log (nao so o nome do campo): saber que "o preco
   * mudou" sem saber de quanto para quanto nao ajuda ninguem numa conferencia.
   */
  private buildUpdateMetadata(
    current: { salePriceCents: number; costPriceCents: number | null },
    dto: UpdateProductDto,
  ): Prisma.InputJsonObject {
    const metadata: Record<string, Prisma.InputJsonValue> = { fields: Object.keys(dto) };

    if (dto.salePrice !== undefined && toCents(dto.salePrice) !== current.salePriceCents) {
      metadata.salePriceChange = { from: current.salePriceCents, to: toCents(dto.salePrice) };
    }

    if (dto.costPrice !== undefined && toCentsOrNull(dto.costPrice) !== current.costPriceCents) {
      metadata.costPriceChange = { from: current.costPriceCents, to: toCentsOrNull(dto.costPrice) };
    }

    return metadata;
  }

  private buildWhere(organizationId: string, query: ListProductsQueryDto): Prisma.ProductWhereInput {
    const search = query.search?.trim();

    return {
      organizationId,
      active: query.active ?? true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              /*
               * Busca normalizada: "sofa" encontra "SOFÁ" porque comparamos a
               * coluna derivada, e nao o texto original. Resolve a limitacao
               * de colacao Unicode do SQLite sem extensao.
               */
              { searchName: { contains: normalizeSearchText(search) } },
              { skuNormalized: { contains: normalizeCode(search) } },
              { barcode: { contains: normalizeBarcode(search) } },
            ],
          }
        : {}),
    };
  }

  /** Sempre id + organizationId: e o que impede IDOR entre tenants. */
  private async getOwnedOrFail(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        trackInventory: true,
        salePriceCents: true,
        costPriceCents: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado');
    }

    return product;
  }

  private async assertCategoryBelongsToOrg(organizationId: string, categoryId?: string | null) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Categoria nao encontrada nesta organizacao');
    }
  }

  /** Unidade do proprio tenant ou padrao do sistema (organizationId nulo). */
  private async assertUnitIsUsable(organizationId: string, unitId?: string | null) {
    if (!unitId) {
      return;
    }

    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: { id: unitId, active: true, OR: [{ organizationId }, { organizationId: null }] },
      select: { id: true },
    });

    if (!unit) {
      throw new BadRequestException('Unidade de medida invalida');
    }
  }

  private async assertCodesAreFree(
    organizationId: string,
    sku?: string | null,
    barcode?: string | null,
    ignoreId?: string,
  ) {
    if (sku) {
      const duplicate = await this.prisma.product.findFirst({
        where: {
          organizationId,
          skuNormalized: normalizeCode(sku),
          ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
        },
        select: { id: true, name: true },
      });

      if (duplicate) {
        throw new ConflictException(
          `Ja existe um produto com este SKU: "${duplicate.name}".`,
        );
      }
    }

    if (barcode) {
      const duplicate = await this.prisma.product.findFirst({
        where: {
          organizationId,
          barcode: normalizeBarcode(barcode),
          ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
        },
        select: { id: true, name: true },
      });

      if (duplicate) {
        throw new ConflictException(
          `Este codigo de barras ja esta associado a "${duplicate.name}".`,
        );
      }
    }
  }
}

export type { StockStatus };
