/**
 * Metricas da visao geral.
 *
 * Tudo aqui vem do que a operacao realmente registrou: produtos, saldos e o
 * ledger de estoque. Nao ha serie de vendas porque nao existe venda no sistema
 * ainda - preencher esse espaco com numero inventado tornaria o painel inutil
 * justamente para a decisao que ele deveria apoiar.
 *
 * Como no resto da API, dinheiro trafega em reais e quantidade em unidades.
 */

export interface DashboardKpisDto {
  activeProducts: number;
  trackedProducts: number;
  /** Soma do saldo de todos os produtos controlados. */
  totalUnits: number;
  /** Valor do estoque a preco de custo; `null` se nenhum produto tem custo. */
  stockValueCost: number | null;
  /** Valor do estoque a preco de venda. */
  stockValueSale: number;
  lowStock: number;
  outOfStock: number;
}

/** Um mes da serie historica. `month` no formato `YYYY-MM`. */
export interface DashboardMonthDto {
  month: string;
  label: string;
  entries: number;
  exits: number;
  movements: number;
}

/**
 * Comparativo entre o mes corrente e o anterior.
 * `change` e a variacao percentual; `null` quando nao ha base de comparacao
 * (dividir por zero diria "aumento infinito", que nao informa nada).
 */
export interface DashboardComparisonDto {
  current: number;
  previous: number;
  change: number | null;
}

export interface DashboardCoverageDto {
  categoryId: string | null;
  name: string;
  products: number;
  units: number;
  /** Participacao no total de itens em estoque, de 0 a 1. */
  share: number;
}

export interface DashboardTopProductDto {
  productId: string;
  name: string;
  movements: number;
  /** Saldo liquido movimentado no periodo (entradas menos saidas). */
  net: number;
  quantity: number;
}

export interface DashboardAlertDto {
  productId: string;
  name: string;
  quantity: number;
  minimum: number | null;
  status: 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface DashboardMetricsDto {
  kpis: DashboardKpisDto;
  /** Serie dos ultimos meses, do mais antigo ao mais recente. */
  monthly: DashboardMonthDto[];
  comparison: {
    entries: DashboardComparisonDto;
    exits: DashboardComparisonDto;
    movements: DashboardComparisonDto;
  };
  coverage: DashboardCoverageDto[];
  topProducts: DashboardTopProductDto[];
  alerts: DashboardAlertDto[];
  /**
   * Falso enquanto o modulo de vendas nao existir. O frontend usa isso para
   * mostrar o espaco reservado em vez de um grafico vazio sem explicacao.
   */
  salesAvailable: boolean;
}
