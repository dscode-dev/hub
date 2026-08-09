import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InventoryCountDto, InventoryCountItemDto } from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { fromMilli, toMilli } from '@/common/utils/money';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '@/modules/audit/audit.service';
import type { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import type { SaveCountItemsDto } from './dto/save-count-items.dto';
import { InventoryLedgerService } from './inventory-ledger.service';
import { MOVEMENT_REFERENCE } from './inventory-movement.types';

const countInclude = {
  items: {
    include: {
      product: {
        select: {
          name: true,
          sku: true,
          unit: { select: { symbol: true } },
          balance: { select: { quantityMilli: true } },
        },
      },
    },
    orderBy: { product: { searchName: 'asc' } },
  },
} satisfies Prisma.InventoryCountInclude;

type CountWithItems = Prisma.InventoryCountGetPayload<{ include: typeof countInclude }>;

/**
 * Inventario fisico.
 *
 * Semantica do snapshot: `expectedQuantityMilli` e capturado quando o item
 * ENTRA na contagem e nunca e recalculado. E ele que:
 *  - torna honesta a comparacao "sistema x contado";
 *  - permite detectar conflito na conclusao (se o saldo atual divergir do
 *    snapshot, houve movimento durante a contagem).
 *
 * Sem isso, uma contagem iniciada de manha sobrescreveria as vendas da tarde.
 */
@Injectable()
export class InventoryCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly auditService: AuditService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateInventoryCountDto): Promise<InventoryCountDto> {
    const organizationId = user.organizationId;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      trackInventory: true,
      active: true,
      ...(dto.scope === 'CATEGORY' ? { categoryId: dto.categoryId ?? undefined } : {}),
      ...(dto.scope === 'SELECTION' ? { id: { in: dto.productIds ?? [] } } : {}),
    };

    if (dto.scope === 'CATEGORY' && !dto.categoryId) {
      throw new BadRequestException('Informe a categoria a ser contada.');
    }

    if (dto.scope === 'SELECTION' && (dto.productIds ?? []).length === 0) {
      throw new BadRequestException('Selecione ao menos um produto.');
    }

    const products = await this.prisma.product.findMany({
      where,
      select: { id: true, balance: { select: { quantityMilli: true } } },
    });

    if (products.length === 0) {
      throw new BadRequestException('Nenhum produto com controle de estoque foi encontrado.');
    }

    const count = await this.prisma.inventoryCount.create({
      data: {
        organizationId,
        status: 'IN_PROGRESS',
        scope: dto.scope,
        categoryId: dto.categoryId ?? null,
        notes: dto.notes ?? null,
        createdByUserId: user.id,
        items: {
          create: products.map((product) => ({
            productId: product.id,
            // Snapshot no momento da criacao da contagem.
            expectedQuantityMilli: product.balance?.quantityMilli ?? 0,
          })),
        },
      },
      include: countInclude,
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'INVENTORY_COUNT_CREATED',
      entity: 'InventoryCount',
      entityId: count.id,
      metadata: { scope: dto.scope, items: products.length },
    });

    return this.toDto(count, true);
  }

  async list(organizationId: string): Promise<InventoryCountDto[]> {
    const counts = await this.prisma.inventoryCount.findMany({
      where: { organizationId },
      include: countInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return counts.map((count) => this.toDto(count, false));
  }

  async findOne(organizationId: string, id: string): Promise<InventoryCountDto> {
    const count = await this.getOwnedOrFail(organizationId, id);
    return this.toDto(count, true);
  }

  /** Salva as quantidades contadas. Nao mexe em estoque - so na contagem. */
  async saveItems(
    user: AuthenticatedUser,
    id: string,
    dto: SaveCountItemsDto,
  ): Promise<InventoryCountDto> {
    const count = await this.getOwnedOrFail(user.organizationId, id);

    this.assertOpen(count);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.inventoryCountItem.update({
          where: { countId_productId: { countId: id, productId: item.productId } },
          data: {
            countedQuantityMilli: item.counted === null ? null : toMilli(item.counted),
            countedAt: item.counted === null ? null : new Date(),
          },
        }),
      ),
    );

    return this.findOne(user.organizationId, id);
  }

  /**
   * Conclui a contagem gerando os ajustes.
   *
   * Tudo em uma transacao: ou todos os movimentos entram e a contagem fecha,
   * ou nada acontece. Uma conclusao pela metade deixaria parte do estoque
   * ajustada e parte nao, sem forma de saber onde parou.
   */
  async complete(user: AuthenticatedUser, id: string): Promise<InventoryCountDto> {
    const organizationId = user.organizationId;
    const count = await this.getOwnedOrFail(organizationId, id);

    this.assertOpen(count);

    const counted = count.items.filter((item) => item.countedQuantityMilli !== null);

    if (counted.length === 0) {
      throw new BadRequestException('Nenhum item foi contado.');
    }

    /*
     * Conflito: o saldo atual precisa ser o mesmo do snapshot. Se mudou, houve
     * venda/entrada durante a contagem e aplicar a diferenca antiga apagaria
     * esse movimento.
     */
    const conflicts = counted
      .filter((item) => (item.product.balance?.quantityMilli ?? 0) !== item.expectedQuantityMilli)
      .map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        expected: fromMilli(item.expectedQuantityMilli),
        current: fromMilli(item.product.balance?.quantityMilli ?? 0),
      }));

    if (conflicts.length > 0) {
      throw new ConflictException({
        message:
          'O estoque de alguns produtos mudou durante a contagem. Revise antes de concluir.',
        conflicts,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of counted) {
        const difference = (item.countedQuantityMilli ?? 0) - item.expectedQuantityMilli;

        if (difference === 0) {
          continue;
        }

        await this.ledger.record(
          {
            organizationId,
            productId: item.productId,
            type: difference > 0 ? 'INVENTORY_GAIN' : 'INVENTORY_LOSS',
            quantityMilli: Math.abs(difference),
            referenceType: MOVEMENT_REFERENCE.inventoryCount,
            referenceId: id,
            reason: 'Ajuste por inventario fisico',
            createdByUserId: user.id,
          },
          tx,
        );
      }

      await tx.inventoryCount.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedByUserId: user.id,
        },
      });
    });

    await this.auditService.record({
      organizationId,
      userId: user.id,
      action: 'INVENTORY_COUNT_COMPLETED',
      entity: 'InventoryCount',
      entityId: id,
      metadata: {
        items: counted.length,
        adjustments: counted.filter(
          (item) => (item.countedQuantityMilli ?? 0) !== item.expectedQuantityMilli,
        ).length,
      },
    });

    return this.findOne(organizationId, id);
  }

  async cancel(user: AuthenticatedUser, id: string): Promise<InventoryCountDto> {
    const count = await this.getOwnedOrFail(user.organizationId, id);
    this.assertOpen(count);

    await this.prisma.inventoryCount.update({ where: { id }, data: { status: 'CANCELLED' } });

    return this.findOne(user.organizationId, id);
  }

  /** Contagem concluida ou cancelada nao volta atras. */
  private assertOpen(count: CountWithItems): void {
    if (count.status === 'COMPLETED') {
      throw new ConflictException('Este inventario ja foi concluido.');
    }

    if (count.status === 'CANCELLED') {
      throw new ConflictException('Este inventario foi cancelado.');
    }
  }

  private async getOwnedOrFail(organizationId: string, id: string): Promise<CountWithItems> {
    const count = await this.prisma.inventoryCount.findFirst({
      where: { id, organizationId },
      include: countInclude,
    });

    if (!count) {
      throw new NotFoundException('Inventario nao encontrado');
    }

    return count;
  }

  private toDto(count: CountWithItems, withItems: boolean): InventoryCountDto {
    const items: InventoryCountItemDto[] = count.items.map((item) => {
      const currentMilli = item.product.balance?.quantityMilli ?? 0;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        unitSymbol: item.product.unit?.symbol ?? null,
        expected: fromMilli(item.expectedQuantityMilli),
        counted: item.countedQuantityMilli === null ? null : fromMilli(item.countedQuantityMilli),
        difference:
          item.countedQuantityMilli === null
            ? null
            : fromMilli(item.countedQuantityMilli - item.expectedQuantityMilli),
        // Sinaliza na interface antes de tentar concluir.
        conflict: count.status !== 'COMPLETED' && currentMilli !== item.expectedQuantityMilli,
      };
    });

    return {
      id: count.id,
      status: count.status,
      scope: count.scope as InventoryCountDto['scope'],
      categoryId: count.categoryId,
      notes: count.notes,
      totalItems: count.items.length,
      countedItems: count.items.filter((item) => item.countedQuantityMilli !== null).length,
      createdAt: count.createdAt.toISOString(),
      completedAt: count.completedAt?.toISOString() ?? null,
      ...(withItems ? { items } : {}),
    };
  }
}
