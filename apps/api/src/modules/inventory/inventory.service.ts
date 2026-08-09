import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InventoryItemDto,
  InventoryMovementDto,
  InventorySummaryDto,
  Paginated,
} from '@hub/shared';
import { paginate } from '@/common/dto/pagination-query.dto';
import { PrismaService } from '@/common/prisma/prisma.service';
import { fromCentsOrNull, fromMilli, fromMilliOrNull, toCentsOrNull, toMilli } from '@/common/utils/money';
import { normalizeSearchText } from '@/common/utils/normalize';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '@/modules/audit/audit.service';
import { resolveStockStatus, toUnitDto } from '@/modules/products/product.mapper';
import type { CreateMovementDto } from './dto/create-movement.dto';
import type { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import type { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { InventoryLedgerService } from './inventory-ledger.service';
import { isManualMovementType } from './inventory-movement.types';

/** Leitura padrao de item de estoque: uma query, sem N+1. */
const inventoryInclude = {
  category: { select: { name: true } },
  unit: { select: { id: true, code: true, name: true, symbol: true, allowsFraction: true } },
  balance: { select: { quantityMilli: true, lastMovementAt: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly auditService: AuditService,
  ) {}

  /** Lista apenas produtos que controlam estoque - os demais nao tem saldo. */
  async list(
    organizationId: string,
    query: ListInventoryQueryDto,
  ): Promise<Paginated<InventoryItemDto>> {
    const search = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      organizationId,
      trackInventory: true,
      active: true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search ? { searchName: { contains: normalizeSearchText(search) } } : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: inventoryInclude,
      orderBy: { searchName: 'asc' },
    });

    const items = products.map((product) => this.toItem(product));

    // Status e derivado, entao o filtro acontece depois do mapeamento -
    // mantendo uma unica definicao da regra (resolveStockStatus).
    const filtered = query.status
      ? items.filter((item) => item.status === query.status)
      : items;

    const start = query.skip;
    return paginate(filtered.slice(start, start + query.pageSize), filtered.length, query);
  }

  async summary(organizationId: string): Promise<InventorySummaryDto> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, trackInventory: true, active: true },
      select: {
        minimumStockMilli: true,
        balance: { select: { quantityMilli: true } },
      },
    });

    let lowStock = 0;
    let outOfStock = 0;

    for (const product of products) {
      const status = resolveStockStatus(
        true,
        product.balance?.quantityMilli ?? 0,
        product.minimumStockMilli,
      );

      if (status === 'OUT_OF_STOCK') {
        outOfStock += 1;
      } else if (status === 'LOW_STOCK') {
        lowStock += 1;
      }
    }

    return { trackedProducts: products.length, lowStock, outOfStock };
  }

  async getProductInventory(organizationId: string, productId: string): Promise<InventoryItemDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: inventoryInclude,
    });

    if (!product) {
      throw new NotFoundException('Produto nao encontrado');
    }

    return this.toItem(product);
  }

  /** Extrato do produto: o "por que" do saldo atual. */
  async listMovements(
    organizationId: string,
    query: ListMovementsQueryDto,
  ): Promise<Paginated<InventoryMovementDto>> {
    const where: Prisma.InventoryMovementWhereInput = {
      organizationId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return paginate(
      movements.map((movement) => ({
        id: movement.id,
        productId: movement.productId,
        productName: movement.product.name,
        type: movement.type,
        quantity: fromMilli(movement.quantityMilli),
        // Gravado no momento do lancamento: historicamente fiel.
        balanceAfter: fromMilli(movement.balanceAfterMilli),
        unitCost: fromCentsOrNull(movement.unitCostCents),
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        reason: movement.reason,
        notes: movement.notes,
        createdByName: movement.createdBy?.name ?? null,
        createdAt: movement.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  /**
   * Movimentacao manual.
   *
   * Restrita aos tipos que uma pessoa realmente lanca. Venda e inventario tem
   * origem propria: aceita-los aqui permitiria forjar historico de operacoes
   * que nunca aconteceram.
   */
  async createMovement(
    user: AuthenticatedUser,
    dto: CreateMovementDto,
  ): Promise<InventoryMovementDto> {
    if (!isManualMovementType(dto.type)) {
      throw new BadRequestException(
        'Este tipo de movimentacao e gerado pelo sistema e nao pode ser lancado manualmente.',
      );
    }

    const recorded = await this.ledger.record({
      organizationId: user.organizationId,
      productId: dto.productId,
      type: dto.type,
      quantityMilli: toMilli(dto.quantity),
      unitCostCents: toCentsOrNull(dto.unitCost),
      reason: dto.reason ?? null,
      notes: dto.notes ?? null,
      createdByUserId: user.id,
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'INVENTORY_MOVEMENT_CREATED',
      entity: 'Product',
      entityId: dto.productId,
      metadata: {
        movementId: recorded.id,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason ?? null,
      },
    });

    const movement = await this.prisma.inventoryMovement.findUniqueOrThrow({
      where: { id: recorded.id },
      include: {
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    return {
      id: movement.id,
      productId: movement.productId,
      productName: movement.product.name,
      type: movement.type,
      quantity: fromMilli(movement.quantityMilli),
      balanceAfter: fromMilli(movement.balanceAfterMilli),
      unitCost: fromCentsOrNull(movement.unitCostCents),
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      reason: movement.reason,
      notes: movement.notes,
      createdByName: movement.createdBy?.name ?? null,
      createdAt: movement.createdAt.toISOString(),
    };
  }

  private toItem(
    product: Prisma.ProductGetPayload<{ include: typeof inventoryInclude }>,
  ): InventoryItemDto {
    const quantityMilli = product.balance?.quantityMilli ?? 0;

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: product.category?.name ?? null,
      unit: toUnitDto(product.unit),
      quantity: fromMilli(quantityMilli),
      minimum: fromMilliOrNull(product.minimumStockMilli),
      status: resolveStockStatus(product.trackInventory, quantityMilli, product.minimumStockMilli),
      lastMovementAt: product.balance?.lastMovementAt?.toISOString() ?? null,
    };
  }
}
