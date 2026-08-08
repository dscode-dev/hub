import type { Route } from 'next';
import Link from 'next/link';
import { ArrowRight, PackagePlus, Upload } from 'lucide-react';
import type { ProductDto } from '@hub/shared';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { formatCurrency } from '@/lib/format';
import { productDetailRoute } from '@/lib/routes';
import { SetupChecklist } from './setup-checklist';
import type { SetupStatus } from './types';

/**
 * Visao com dados reais. Mostramos apenas o que ja e verdade hoje (catalogo);
 * indicadores de venda e financeiro chegam junto com seus modulos, e nao como
 * caixas zeradas.
 */
export function DashboardOverview({
  greeting,
  setup,
  recentProducts,
}: {
  greeting: string;
  setup: SetupStatus;
  recentProducts: ProductDto[];
}) {
  const pendingSteps = setup.steps.filter((step) => step.available && !step.done);

  return (
    <div>
      <PageHeader
        title={`Ola, ${greeting}`}
        description="Aqui esta o resumo do que ja esta organizado na sua operacao."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/products/import">
                <Upload className="size-4" />
                Importar
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <PackagePlus className="size-4" />
                Novo produto
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Produtos ativos"
              value={setup.productsCount.toString()}
              href="/products"
            />
            <StatCard
              label="Categorias"
              value={setup.categoriesCount.toString()}
              href="/products"
            />
          </div>

          <section className="rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">
                Ultimos produtos cadastrados
              </h2>
              <Link
                href="/products"
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                Ver todos
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <ul className="divide-y divide-line">
              {recentProducts.map((product) => (
                <li key={product.id}>
                  <Link
                    href={productDetailRoute(product.id)}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">
                        {product.name}
                      </span>
                      <span className="block truncate text-xs text-foreground-subtle">
                        {product.category?.name ?? 'Sem categoria'}
                        {product.sku ? ` · ${product.sku}` : ''}
                      </span>
                    </span>

                    <span className="shrink-0 text-sm font-medium text-foreground tabular">
                      {formatCurrency(product.salePrice)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          {pendingSteps.length > 0 || setup.steps.some((step) => !step.available) ? (
            <SetupChecklist setup={setup} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; href: Route }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand-300"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground tabular">{value}</p>
    </Link>
  );
}
