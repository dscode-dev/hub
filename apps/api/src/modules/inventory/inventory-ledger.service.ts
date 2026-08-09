import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { fromMilli } from '@/common/utils/money';
import { MOVEMENT_DIRECTION } from './inventory-movement.types';

/**
 * Ledger de estoque.
 *
 * Ponto UNICO por onde o saldo muda. Nenhum outro service escreve em
 * `inventory_balances` ou `inventory_movements` - qualquer dominio futuro
 * (venda, compra, devolucao) passa por aqui.
 *
 * Cada registro executa, na mesma transacao:
 *   ler saldo -> validar -> gravar movimento -> atualizar projecao
 *
 * O metodo recebe um `tx` opcional para que operacoes maiores (criar produto
 * com estoque inicial, concluir inventario, importar CSV) incluam o movimento
 * na SUA transacao, sem abrir uma aninhada.
 */

export interface RecordMovementInput {
  organizationId: string;
  productId: string;
  type: InventoryMovementType;
  /** MILESIMOS, sempre positivo. O sinal vem do tipo, nunca do chamador. */
  quantityMilli: number;
  unitCostCents?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdByUserId?: string | null;
}

export interface RecordedMovement {
  id: string;
  quantityMilli: number;
  balanceAfterMilli: number;
}

/** Cliente ou transacao: o ledger funciona igual nos dois. */
type PrismaLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InventoryLedgerService {
  private readonly logger = new Logger(InventoryLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um movimento e atualiza o saldo atomicamente.
   *
   * Sem `tx`, abre a propria transacao. Com `tx`, participa da transacao de
   * quem chamou - o que garante que criar produto + estoque inicial seja tudo
   * ou nada.
   */
  async record(input: RecordMovementInput, tx?: Prisma.TransactionClient): Promise<RecordedMovement> {
    if (tx) {
      return this.write(tx, input);
    }

    return this.prisma.$transaction((transaction) => this.write(transaction, input));
  }

  private async write(
    tx: Prisma.TransactionClient,
    input: RecordMovementInput,
  ): Promise<RecordedMovement> {
    const magnitude = Math.trunc(input.quantityMilli);

    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new BadRequestException('A quantidade da movimentacao deve ser maior que zero.');
    }

    // Sempre id + organizationId: e o que impede movimentar produto de outro tenant.
    const product = await tx.product.findFirst({
      where: { id: input.productId, organizationId: input.organizationId },
      select: {
        id: true,
        name: true,
        active: true,
        trackInventory: true,
        unit: { select: { symbol: true, allowsFraction: true } },
      },
    });

    if (!product) {
      // Mesmo 404 para "nao existe" e "e de outro tenant": indistinguiveis de fora,
      // entao conhecer um UUID valido nao confirma que ele existe.
      throw new NotFoundException('Produto nao encontrado.');
    }

    if (!product.trackInventory) {
      throw new BadRequestException(
        `"${product.name}" nao controla estoque. Ative o controle para registrar movimentacoes.`,
      );
    }

    if (!product.active) {
      throw new BadRequestException(
        `"${product.name}" esta desativado e nao aceita movimentacoes.`,
      );
    }

    // A unidade decide se fracao faz sentido: 2,5 kg e normal, 2,5 pecas nao e.
    // A checagem mora aqui porque este e o unico caminho que altera saldo -
    // movimento avulso, estoque inicial, contagem e importacao passam todos por
    // este metodo, entao a regra nao precisa ser repetida (nem esquecida) neles.
    if (product.unit && !product.unit.allowsFraction && magnitude % 1_000 !== 0) {
      throw new BadRequestException(
        `"${product.name}" e medido em ${product.unit.symbol} e nao aceita quantidade fracionada.`,
      );
    }

    const signed = magnitude * MOVEMENT_DIRECTION[input.type];

    const balance = await tx.inventoryBalance.findUnique({
      where: { productId: product.id },
      select: { quantityMilli: true },
    });

    const currentMilli = balance?.quantityMilli ?? 0;
    const nextMilli = currentMilli + signed;

    if (nextMilli < 0) {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: input.organizationId },
        select: { allowNegativeInventory: true },
      });

      if (!organization.allowNegativeInventory) {
        throw new ConflictException(
          `Estoque insuficiente para "${product.name}". Disponivel: ${formatQuantity(currentMilli)}.`,
        );
      }
    }

    const movement = await tx.inventoryMovement.create({
      data: {
        organizationId: input.organizationId,
        productId: product.id,
        type: input.type,
        quantityMilli: signed,
        balanceAfterMilli: nextMilli,
        unitCostCents: input.unitCostCents ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
      select: { id: true },
    });

    /*
     * Projecao atualizada na mesma transacao. `upsert` cobre o primeiro
     * movimento do produto sem precisar de um passo separado na criacao.
     */
    await tx.inventoryBalance.upsert({
      where: { productId: product.id },
      create: {
        organizationId: input.organizationId,
        productId: product.id,
        quantityMilli: nextMilli,
        lastMovementAt: new Date(),
      },
      update: {
        quantityMilli: nextMilli,
        lastMovementAt: new Date(),
      },
    });

    return { id: movement.id, quantityMilli: signed, balanceAfterMilli: nextMilli };
  }

  /** Saldo atual de um produto, em milesimos. */
  async getBalanceMilli(
    organizationId: string,
    productId: string,
    client: PrismaLike = this.prisma,
  ): Promise<number> {
    const balance = await client.inventoryBalance.findFirst({
      where: { productId, organizationId },
      select: { quantityMilli: true },
    });

    return balance?.quantityMilli ?? 0;
  }

  /**
   * Recalcula a projecao a partir do ledger.
   *
   * Nao faz parte do fluxo normal - existe como ferramenta de conferencia:
   * o ledger e a verdade, entao um saldo divergente pode sempre ser refeito.
   */
  async recomputeBalance(organizationId: string, productId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.inventoryMovement.aggregate({
        where: { organizationId, productId },
        _sum: { quantityMilli: true },
        _max: { createdAt: true },
      });

      const total = aggregate._sum.quantityMilli ?? 0;

      await tx.inventoryBalance.upsert({
        where: { productId },
        create: {
          organizationId,
          productId,
          quantityMilli: total,
          lastMovementAt: aggregate._max.createdAt,
        },
        update: { quantityMilli: total, lastMovementAt: aggregate._max.createdAt },
      });

      this.logger.warn(`Saldo recalculado a partir do ledger: produto ${productId} = ${total}`);

      return total;
    });
  }
}

function formatQuantity(milli: number): string {
  return fromMilli(milli).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
