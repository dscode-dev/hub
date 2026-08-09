'use client';

import type { Route } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Layers,
  Minus,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardAlertDto, DashboardComparisonDto, DashboardMetricsDto } from '@hub/shared';
import { LineChart } from '@/components/charts/line-chart';
import { RadarChart } from '@/components/charts/radar-chart';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { productDetailRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

/**
 * Painel de metricas da operacao.
 *
 * Tudo aqui sai do que a loja registrou de fato. O bloco de vendas fica
 * explicitamente reservado enquanto o modulo nao existe - um grafico zerado
 * seria lido como "vendeu nada", que e diferente de "ainda nao da para saber".
 */
export function MetricsPanel({ metrics }: { metrics: DashboardMetricsDto }) {
  const { kpis, monthly, comparison, coverage, topProducts, alerts } = metrics;
  const hasHistory = monthly.some((month) => month.movements > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Package}
          label="Produtos ativos"
          value={String(kpis.activeProducts)}
          hint={`${kpis.trackedProducts} com controle de estoque`}
          href="/products"
        />
        <Kpi
          icon={Boxes}
          label="Itens em estoque"
          value={formatQuantity(kpis.totalUnits)}
          hint="Soma dos saldos atuais"
          href="/inventory"
        />
        <Kpi
          icon={Wallet}
          label="Valor do estoque"
          value={formatCurrency(kpis.stockValueSale)}
          hint={
            kpis.stockValueCost === null
              ? 'A preco de venda; custo nao informado'
              : `${formatCurrency(kpis.stockValueCost)} a preco de custo`
          }
        />
        <Kpi
          icon={AlertTriangle}
          label="Precisam de atencao"
          value={String(kpis.lowStock + kpis.outOfStock)}
          hint={`${kpis.outOfStock} sem estoque, ${kpis.lowStock} abaixo do minimo`}
          href="/inventory"
          tone={kpis.lowStock + kpis.outOfStock > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title="Entradas e saidas"
          description="Movimentacao de estoque nos ultimos seis meses."
        >
          {hasHistory ? (
            <>
              <LineChart
                labels={monthly.map((month) => month.label)}
                format={(value) => formatQuantity(Math.round(value))}
                series={[
                  {
                    label: 'Entradas',
                    values: monthly.map((month) => month.entries),
                    color: 'var(--color-brand-600)',
                    filled: true,
                  },
                  {
                    label: 'Saidas',
                    values: monthly.map((month) => month.exits),
                    color: 'var(--color-warning)',
                  },
                ]}
              />

              <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
                <Delta label="Entradas no mes" data={comparison.entries} unit="itens" />
                <Delta label="Saidas no mes" data={comparison.exits} unit="itens" />
                <Delta label="Movimentacoes" data={comparison.movements} unit="registros" />
              </div>
            </>
          ) : (
            <Placeholder
              icon={TrendingUp}
              title="Sem movimentacao ainda"
              description="Assim que houver entradas e saidas, a evolucao mes a mes aparece aqui."
            />
          )}
        </Card>

        <Card
          title="Cobertura por categoria"
          description="Como o estoque esta distribuido entre as categorias."
        >
          {coverage.length > 0 ? (
            <RadarChart
              points={coverage.map((item) => ({
                label: item.name,
                value: item.share,
                detail: `${item.products} produto${item.products === 1 ? '' : 's'}`,
              }))}
            />
          ) : (
            <Placeholder
              icon={Layers}
              title="Nada para comparar"
              description="Classifique os produtos em categorias para enxergar a concentracao do estoque."
            />
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card
          title="Produtos mais movimentados"
          description="Maior volume de entrada e saida no periodo."
        >
          {topProducts.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {topProducts.map((product) => (
                <li key={product.productId} className="flex items-center gap-4 py-2.5 first:pt-0">
                  <Link
                    href={productDetailRoute(product.productId)}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-brand-700"
                  >
                    {product.name}
                  </Link>

                  <span className="shrink-0 text-xs text-foreground-subtle">
                    {product.movements} mov.
                  </span>

                  <span
                    className={cn(
                      'w-20 shrink-0 text-right text-sm font-medium tabular-nums',
                      product.net > 0 && 'text-success',
                      product.net < 0 && 'text-danger',
                      product.net === 0 && 'text-foreground-muted',
                    )}
                  >
                    {product.net > 0 ? '+' : ''}
                    {formatQuantity(product.net)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder
              icon={Boxes}
              title="Nenhuma movimentacao no periodo"
              description="Os produtos com mais entradas e saidas aparecem aqui."
            />
          )}
        </Card>

        <Card title="Precisam de reposicao" description="Itens no limite ou zerados.">
          {alerts.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {alerts.map((alert) => (
                <li key={alert.productId} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <Link
                    href={productDetailRoute(alert.productId)}
                    className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-brand-700"
                  >
                    {alert.name}
                  </Link>

                  <StatusPill status={alert.status} />

                  <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                    {formatQuantity(alert.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Placeholder
              icon={Boxes}
              title="Estoque em dia"
              description="Nenhum item abaixo do minimo definido."
            />
          )}
        </Card>
      </div>

      {/*
       * Espaco reservado, nao grafico vazio: o modulo de vendas ainda nao
       * existe, entao qualquer numero aqui seria invencao.
       */}
      <Card
        title="Vendas"
        description="Faturamento, ticket medio e curva de vendas por mes."
      >
        <Placeholder
          icon={ShoppingCart}
          title="Disponivel com o modulo de vendas"
          description="Quando o PDV entrar no ar, os indicadores de faturamento e a comparacao mes a mes aparecem aqui, com os mesmos dados que alimentam o estoque."
        />
      </Card>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-foreground-subtle">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  href?: Route;
  tone?: 'neutral' | 'warning';
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          {label}
        </span>
        <Icon
          className={cn('size-4', tone === 'warning' ? 'text-warning' : 'text-foreground-subtle')}
        />
      </div>

      <p
        className={cn(
          'mt-2 text-2xl font-semibold tabular-nums',
          tone === 'warning' ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-foreground-subtle">{hint}</p>
    </>
  );

  const className = cn(
    'block rounded-xl border border-line bg-surface p-5 transition-colors',
    href && 'hover:border-brand-300',
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Variacao contra o mes anterior. */
function Delta({
  label,
  data,
  unit,
}: {
  label: string;
  data: DashboardComparisonDto;
  unit: string;
}) {
  const change = data.change;
  const direction = change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <div>
      <p className="text-xs text-foreground-subtle">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {formatQuantity(data.current)}{' '}
        <span className="text-xs font-normal text-foreground-subtle">{unit}</span>
      </p>

      <p
        className={cn(
          'mt-0.5 flex items-center gap-1 text-xs',
          direction === 'up' && 'text-success',
          direction === 'down' && 'text-danger',
          direction === 'flat' && 'text-foreground-subtle',
        )}
      >
        <Icon className="size-3.5" />
        {change === null
          ? 'Sem base no mes anterior'
          : `${Math.abs(Math.round(change * 100))}% vs. mes anterior`}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: DashboardAlertDto['status'] }) {
  const out = status === 'OUT_OF_STOCK';

  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
        out ? 'bg-danger-surface text-danger' : 'bg-warning-surface text-warning',
      )}
    >
      {out ? 'Sem estoque' : 'Baixo'}
    </span>
  );
}

function Placeholder({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
      <Icon className="size-5 text-foreground-subtle" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-foreground-subtle">{description}</p>
    </div>
  );
}
