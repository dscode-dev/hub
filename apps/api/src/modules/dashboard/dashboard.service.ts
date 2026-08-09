import { Injectable } from '@nestjs/common';
import type {
  DashboardAlertDto,
  DashboardComparisonDto,
  DashboardCoverageDto,
  DashboardMetricsDto,
  DashboardMonthDto,
  DashboardTopProductDto,
} from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { fromCents, fromMilli } from '@/common/utils/money';
import { resolveStockStatus } from '@/modules/products/product.mapper';

/** Quantos meses a serie historica cobre, incluindo o corrente. */
const HISTORY_MONTHS = 6;
/** Categorias no radar. Acima disso o grafico vira mancha ilegivel. */
const COVERAGE_SLOTS = 6;
const TOP_PRODUCTS = 5;
const MAX_ALERTS = 5;

const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/**
 * Metricas da visao geral.
 *
 * Todas derivam do que a operacao registrou - produtos, saldos e ledger. Nao
 * existe metrica de venda porque nao existe venda no sistema; o campo
 * `salesAvailable` diz isso ao frontend em vez de devolver zeros que pareceriam
 * "vendeu nada" quando na verdade e "ainda nao da para saber".
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics(organizationId: string): Promise<DashboardMetricsDto> {
    const since = startOfMonth(monthsAgo(HISTORY_MONTHS - 1));

    const [products, movements] = await Promise.all([
      this.prisma.product.findMany({
        where: { organizationId, active: true },
        select: {
          id: true,
          name: true,
          trackInventory: true,
          minimumStockMilli: true,
          salePriceCents: true,
          costPriceCents: true,
          categoryId: true,
          category: { select: { name: true } },
          balance: { select: { quantityMilli: true } },
        },
      }),
      /*
       * A serie inteira vem numa consulta so e e agregada em memoria. O volume
       * e de meses de movimentacao de uma loja, nao de um data warehouse -
       * varias queries agrupadas custariam mais round-trips do que economizariam
       * em processamento.
       */
      this.prisma.inventoryMovement.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: {
          productId: true,
          quantityMilli: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
    ]);

    return {
      kpis: this.buildKpis(products),
      monthly: this.buildMonthly(movements),
      comparison: this.buildComparison(movements),
      coverage: this.buildCoverage(products),
      topProducts: this.buildTopProducts(movements),
      alerts: this.buildAlerts(products),
      // Vira true quando o modulo de vendas existir.
      salesAvailable: false,
    };
  }

  private buildKpis(products: ProductRow[]): DashboardMetricsDto['kpis'] {
    const tracked = products.filter((product) => product.trackInventory);

    let totalMilli = 0;
    let saleCents = 0;
    let costCents = 0;
    let withCost = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const product of tracked) {
      const quantityMilli = product.balance?.quantityMilli ?? 0;
      totalMilli += quantityMilli;

      // Saldo negativo (organizacao que permite) nao vira valor negativo de
      // patrimonio: para valor de estoque, o que nao existe vale zero.
      const valued = Math.max(quantityMilli, 0);

      saleCents += (valued * product.salePriceCents) / 1000;

      if (product.costPriceCents !== null) {
        costCents += (valued * product.costPriceCents) / 1000;
        withCost += 1;
      }

      const status = resolveStockStatus(true, quantityMilli, product.minimumStockMilli);

      if (status === 'OUT_OF_STOCK') {
        outOfStock += 1;
      } else if (status === 'LOW_STOCK') {
        lowStock += 1;
      }
    }

    return {
      activeProducts: products.length,
      trackedProducts: tracked.length,
      totalUnits: fromMilli(totalMilli),
      // Sem nenhum custo cadastrado o total seria R$ 0,00 - o que se leria como
      // "estoque sem valor" em vez de "custo nao informado".
      stockValueCost: withCost > 0 ? fromCents(Math.round(costCents)) : null,
      stockValueSale: fromCents(Math.round(saleCents)),
      lowStock,
      outOfStock,
    };
  }

  private buildMonthly(movements: MovementRow[]): DashboardMonthDto[] {
    const buckets = new Map<string, DashboardMonthDto>();

    for (let index = HISTORY_MONTHS - 1; index >= 0; index -= 1) {
      const date = monthsAgo(index);
      const key = monthKey(date);

      buckets.set(key, {
        month: key,
        label: `${MONTH_LABELS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`,
        entries: 0,
        exits: 0,
        movements: 0,
      });
    }

    for (const movement of movements) {
      const bucket = buckets.get(monthKey(movement.createdAt));

      if (!bucket) {
        continue;
      }

      bucket.movements += 1;

      if (movement.quantityMilli >= 0) {
        bucket.entries += movement.quantityMilli;
      } else {
        // Saida sai positiva no grafico: comparar duas curvas exige mesmo eixo.
        bucket.exits += Math.abs(movement.quantityMilli);
      }
    }

    return [...buckets.values()].map((bucket) => ({
      ...bucket,
      entries: fromMilli(bucket.entries),
      exits: fromMilli(bucket.exits),
    }));
  }

  private buildComparison(movements: MovementRow[]): DashboardMetricsDto['comparison'] {
    const current = monthKey(new Date());
    const previous = monthKey(monthsAgo(1));

    const totals = {
      [current]: { entries: 0, exits: 0, movements: 0 },
      [previous]: { entries: 0, exits: 0, movements: 0 },
    };

    for (const movement of movements) {
      const bucket = totals[monthKey(movement.createdAt)];

      if (!bucket) {
        continue;
      }

      bucket.movements += 1;

      if (movement.quantityMilli >= 0) {
        bucket.entries += movement.quantityMilli;
      } else {
        bucket.exits += Math.abs(movement.quantityMilli);
      }
    }

    return {
      entries: compare(fromMilli(totals[current].entries), fromMilli(totals[previous].entries)),
      exits: compare(fromMilli(totals[current].exits), fromMilli(totals[previous].exits)),
      movements: compare(totals[current].movements, totals[previous].movements),
    };
  }

  /**
   * Concentracao do estoque por categoria.
   *
   * Responde "minha operacao esta apoiada em quantas frentes?". Categoria unica
   * com 90% do estoque e um risco que nenhum KPI isolado mostra.
   */
  private buildCoverage(products: ProductRow[]): DashboardCoverageDto[] {
    const groups = new Map<string, DashboardCoverageDto & { milli: number }>();

    for (const product of products) {
      if (!product.trackInventory) {
        continue;
      }

      const key = product.categoryId ?? 'sem-categoria';
      const existing = groups.get(key) ?? {
        categoryId: product.categoryId,
        name: product.category?.name ?? 'Sem categoria',
        products: 0,
        units: 0,
        share: 0,
        milli: 0,
      };

      existing.products += 1;
      existing.milli += Math.max(product.balance?.quantityMilli ?? 0, 0);
      groups.set(key, existing);
    }

    const ranked = [...groups.values()].sort((a, b) => b.milli - a.milli).slice(0, COVERAGE_SLOTS);
    const total = ranked.reduce((sum, group) => sum + group.milli, 0);

    return ranked.map(({ milli, ...group }) => ({
      ...group,
      units: fromMilli(milli),
      share: total > 0 ? milli / total : 0,
    }));
  }

  private buildTopProducts(movements: MovementRow[]): DashboardTopProductDto[] {
    const groups = new Map<string, { name: string; movements: number; net: number; abs: number }>();

    for (const movement of movements) {
      const existing = groups.get(movement.productId) ?? {
        name: movement.product.name,
        movements: 0,
        net: 0,
        abs: 0,
      };

      existing.movements += 1;
      existing.net += movement.quantityMilli;
      existing.abs += Math.abs(movement.quantityMilli);
      groups.set(movement.productId, existing);
    }

    return [...groups.entries()]
      // Ordena pelo volume absoluto: um item que entrou 100 e saiu 100 e ativo,
      // mesmo com saldo liquido zero.
      .sort(([, a], [, b]) => b.abs - a.abs)
      .slice(0, TOP_PRODUCTS)
      .map(([productId, group]) => ({
        productId,
        name: group.name,
        movements: group.movements,
        net: fromMilli(group.net),
        quantity: fromMilli(group.abs),
      }));
  }

  private buildAlerts(products: ProductRow[]): DashboardAlertDto[] {
    const alerts: DashboardAlertDto[] = [];

    for (const product of products) {
      if (!product.trackInventory) {
        continue;
      }

      const quantityMilli = product.balance?.quantityMilli ?? 0;
      const status = resolveStockStatus(true, quantityMilli, product.minimumStockMilli);

      if (status === 'OUT_OF_STOCK' || status === 'LOW_STOCK') {
        alerts.push({
          productId: product.id,
          name: product.name,
          quantity: fromMilli(quantityMilli),
          minimum:
            product.minimumStockMilli === null ? null : fromMilli(product.minimumStockMilli),
          status,
        });
      }
    }

    // Sem estoque antes de estoque baixo: urgencia primeiro.
    return alerts
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'OUT_OF_STOCK' ? -1 : 1;
        }

        return a.quantity - b.quantity;
      })
      .slice(0, MAX_ALERTS);
  }
}

interface ProductRow {
  id: string;
  name: string;
  trackInventory: boolean;
  minimumStockMilli: number | null;
  salePriceCents: number;
  costPriceCents: number | null;
  categoryId: string | null;
  category: { name: string } | null;
  balance: { quantityMilli: number } | null;
}

interface MovementRow {
  productId: string;
  quantityMilli: number;
  createdAt: Date;
  product: { name: string };
}

function compare(current: number, previous: number): DashboardComparisonDto {
  return {
    current,
    previous,
    // Sem base anterior nao ha variacao a informar: "+infinito" nao ajuda quem
    // esta lendo o painel no primeiro mes de uso.
    change: previous === 0 ? null : (current - previous) / previous,
  };
}

function monthsAgo(count: number): Date {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - count);

  return date;
}

function startOfMonth(date: Date): Date {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  return start;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
