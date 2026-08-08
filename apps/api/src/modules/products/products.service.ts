import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Paginated, ProductDto } from '@hub/shared';
import { paginate } from '@/common/dto/pagination-query.dto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { toCents, toCentsOrNull, toMilli, toMilliOrNull } from '@/common/utils/money';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '@/modules/audit/audit.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto, ProductSortField } from './dto/list-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { productInclude, toProductDto } from './product.mapper';

/** Campo publico de ordenacao -> coluna real (preco vive em centavos). */
const SORT_COLUMNS: Record<ProductSortField, 'name' | 'salePriceCents' | 'createdAt'> = {
  name: 'name',
  salePrice: 'salePriceCents',
  createdAt: 'createdAt',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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

    return paginate(products.map(toProductDto), total, query);
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

  async create(user: AuthenticatedUser, dto: CreateProductDto): Promise<ProductDto> {
    const organizationId = user.organizationId;

    await this.assertCategoryBelongsToOrg(organizationId, dto.categoryId);
    await this.assertCodesAreFree(organizationId, dto.sku, dto.barcode);

    const trackInventory = dto.trackInventory ?? false;

    const product = await this.prisma.product.create({
      data: {
        organizationId,
        name: dto.name,
        salePriceCents: toCents(dto.salePrice),
        sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,
        description: dto.description ?? null,
        categoryId: dto.categoryId ?? null,
        costPriceCents: toCentsOrNull(dto.costPrice),
        active: dto.active ?? true,
        trackInventory,
        // Quantidades so fazem sentido com controle de estoque ligado.
        stockQuantityMilli: toMilli(trackInventory ? (dto.stockQuantity ?? 0) : 0),
        minStockQuantityMilli:
          trackInventory ? toMilliOrNull(dto.minStockQuantity) : null,
      },
      include: productInclude,
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      metadata: { name: product.name, sku: product.sku },
    });

    return toProductDto(product);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProductDto): Promise<ProductDto> {
    const organizationId = user.organizationId;
    const current = await this.getOwnedOrFail(organizationId, id);

    await this.assertCategoryBelongsToOrg(organizationId, dto.categoryId);
    await this.assertCodesAreFree(organizationId, dto.sku, dto.barcode, id);

    const trackInventory = dto.trackInventory ?? current.trackInventory;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        salePriceCents: dto.salePrice === undefined ? undefined : toCents(dto.salePrice),
        sku: dto.sku,
        barcode: dto.barcode,
        description: dto.description,
        categoryId: dto.categoryId,
        costPriceCents: dto.costPrice === undefined ? undefined : toCentsOrNull(dto.costPrice),
        active: dto.active,
        trackInventory: dto.trackInventory,
        stockQuantityMilli: this.resolveStockUpdate(trackInventory, dto.stockQuantity),
        minStockQuantityMilli: this.resolveMinStockUpdate(trackInventory, dto.minStockQuantity),
      },
      include: productInclude,
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: product.id,
      metadata: { fields: Object.keys(dto) },
    });

    return toProductDto(product);
  }

  /**
   * Soft delete: o produto e desativado, nunca removido.
   * Historico de vendas e movimentacoes futuras continuam validos.
   */
  async deactivate(user: AuthenticatedUser, id: string): Promise<ProductDto> {
    const organizationId = user.organizationId;
    await this.getOwnedOrFail(organizationId, id);

    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false },
      include: productInclude,
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'PRODUCT_DEACTIVATED',
      entity: 'Product',
      entityId: product.id,
      metadata: { name: product.name },
    });

    return toProductDto(product);
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
              // SQLite: LIKE ja ignora caixa para ASCII, e o conector nao
              // aceita `mode`. Acentos continuam sensiveis a caixa.
              { name: { contains: search } },
              { sku: { contains: search } },
              { barcode: { contains: search } },
            ],
          }
        : {}),
    };
  }

  /** Desligar o controle de estoque zera o saldo; ligado, so muda se enviado. */
  private resolveStockUpdate(trackInventory: boolean, value: number | undefined) {
    if (!trackInventory) {
      return 0;
    }

    return value === undefined ? undefined : toMilli(value);
  }

  private resolveMinStockUpdate(trackInventory: boolean, value: number | null | undefined) {
    if (!trackInventory) {
      return null;
    }

    return value === undefined ? undefined : toMilliOrNull(value);
  }

  /** Sempre id + organizationId: e o que impede IDOR entre tenants. */
  private async getOwnedOrFail(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      select: { id: true, trackInventory: true },
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

  private async assertCodesAreFree(
    organizationId: string,
    sku?: string | null,
    barcode?: string | null,
    ignoreId?: string,
  ) {
    if (sku) {
      const duplicate = await this.prisma.product.findFirst({
        where: { organizationId, sku, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('Ja existe um produto com esse SKU');
      }
    }

    if (barcode) {
      const duplicate = await this.prisma.product.findFirst({
        where: { organizationId, barcode, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException('Ja existe um produto com esse codigo de barras');
      }
    }
  }
}
