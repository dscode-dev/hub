import Link from 'next/link';
import { ChevronRight, Package, PackagePlus, SearchX, Upload } from 'lucide-react';
import type { Paginated, ProductDto } from '@hub/shared';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { productDetailRoute } from '@/lib/routes';
import { ProductsPagination } from './products-pagination';

interface ProductsTableProps {
  products: ProductDto[];
  meta: Paginated<ProductDto>['meta'];
  search: string;
  showingInactive: boolean;
}

/**
 * Listagem responsiva: tabela no desktop, cartoes no mobile.
 * Uma tabela de 6 colunas em telefone e inutilizavel, entao o mesmo dado troca
 * de forma em vez de rolar horizontalmente.
 */
export function ProductsTable({ products, meta, search, showingInactive }: ProductsTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        {search ? (
          <EmptyState
            icon={SearchX}
            title={`Nenhum produto encontrado para "${search}"`}
            description="Verifique a escrita ou tente buscar por outra parte do nome, SKU ou codigo de barras."
            action={
              <Button asChild variant="secondary">
                <Link href="/products">Limpar busca</Link>
              </Button>
            }
          />
        ) : showingInactive ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto removido"
            description="Produtos removidos ficam guardados aqui e podem ser reativados a qualquer momento."
            action={
              <Button asChild variant="secondary">
                <Link href="/products">Ver produtos ativos</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Seu catalogo esta vazio"
            description="Cadastre o primeiro produto ou traga sua planilha. Nome e preco ja sao suficientes para comecar."
            action={
              <>
                <Button asChild>
                  <Link href="/products/new">
                    <PackagePlus className="size-4" />
                    Cadastrar produto
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/products/import">
                    <Upload className="size-4" />
                    Importar CSV
                  </Link>
                </Button>
              </>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: cartoes */}
      <ul className="flex flex-col gap-2 md:hidden">
        {products.map((product) => (
          <li key={product.id}>
            <Link
              href={productDetailRoute(product.id)}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors active:bg-surface-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </span>
                  {!product.active ? <Badge variant="neutral">Removido</Badge> : null}
                </span>

                <span className="mt-0.5 block truncate text-xs text-foreground-subtle">
                  {product.category?.name ?? 'Sem categoria'}
                  {product.sku ? ` · ${product.sku}` : ''}
                </span>

                <span className="mt-1.5 flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground tabular">
                    {formatCurrency(product.salePrice)}
                  </span>
                  {product.trackInventory ? (
                    <StockBadge product={product} />
                  ) : null}
                </span>
              </span>

              <ChevronRight className="size-4 shrink-0 text-foreground-subtle" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
              <th scope="col" className="px-5 py-3">
                Produto
              </th>
              <th scope="col" className="px-5 py-3">
                Categoria
              </th>
              <th scope="col" className="px-5 py-3">
                SKU
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Estoque
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Preco
              </th>
              <th scope="col" className="w-10 px-5 py-3">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {products.map((product) => (
              <tr key={product.id} className="group transition-colors hover:bg-surface-muted">
                <td className="max-w-[320px] px-5 py-3">
                  <Link
                    href={productDetailRoute(product.id)}
                    className="flex items-center gap-2 font-medium text-foreground"
                  >
                    <span className="truncate">{product.name}</span>
                    {!product.active ? <Badge variant="neutral">Removido</Badge> : null}
                  </Link>
                </td>

                <td className="px-5 py-3 text-foreground-muted">
                  {product.category?.name ?? '—'}
                </td>

                <td className="px-5 py-3 text-foreground-muted tabular">
                  {product.sku ?? '—'}
                </td>

                <td className="px-5 py-3 text-right">
                  {product.trackInventory ? (
                    <StockBadge product={product} />
                  ) : (
                    <span className="text-foreground-subtle">Nao controla</span>
                  )}
                </td>

                <td className="px-5 py-3 text-right font-medium text-foreground tabular">
                  {formatCurrency(product.salePrice)}
                </td>

                <td className="px-5 py-3">
                  <Link
                    href={productDetailRoute(product.id)}
                    aria-label={`Abrir ${product.name}`}
                    className="flex justify-end text-foreground-subtle transition-colors group-hover:text-brand-600"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProductsPagination meta={meta} />
    </div>
  );
}

/** Sinaliza estoque abaixo do minimo sem exigir que o usuario compare numeros. */
function StockBadge({ product }: { product: ProductDto }) {
  const low =
    product.minStockQuantity !== null && product.stockQuantity <= product.minStockQuantity;

  return (
    <Badge variant={low ? 'warning' : 'neutral'} className="tabular">
      {formatQuantity(product.stockQuantity)}
      {low ? ' · baixo' : ''}
    </Badge>
  );
}
