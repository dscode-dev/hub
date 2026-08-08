import type { Metadata } from 'next';
import { Suspense } from 'react';
import type { Paginated, ProductDto } from '@hub/shared';
import { ErrorState } from '@/components/common/error-state';
import { serverFetch } from '@/lib/api/server';
import { requireSession } from '@/lib/session';
import { ActivationPanel } from './activation-panel';
import { DashboardOverview } from './dashboard-overview';
import { DashboardSkeleton } from './dashboard-skeleton';
import type { SetupStatus } from './types';

export const metadata: Metadata = {
  title: 'Visao geral',
};

export default async function DashboardPage() {
  const session = await requireSession();
  const firstName = session.user.name.split(' ')[0] ?? session.user.name;

  return (
    <Suspense fallback={<DashboardSkeleton greeting={firstName} />}>
      <DashboardContent greeting={firstName} />
    </Suspense>
  );
}

async function DashboardContent({ greeting }: { greeting: string }) {
  let setup: SetupStatus;
  let products: Paginated<ProductDto>;

  try {
    [setup, products] = await Promise.all([
      serverFetch<SetupStatus>('/organizations/me/setup-status'),
      serverFetch<Paginated<ProductDto>>('/products?pageSize=5&sortBy=createdAt&sortOrder=desc'),
    ]);
  } catch {
    return (
      <ErrorState description="Nao conseguimos carregar o resumo da sua operacao. Atualize a pagina para tentar de novo." />
    );
  }

  /*
   * Regra da tela: sem dados, nao mostramos cards com zero.
   * Um painel de ativacao vale mais do que um dashboard vazio.
   */
  if (setup.productsCount === 0) {
    return <ActivationPanel greeting={greeting} setup={setup} />;
  }

  return <DashboardOverview greeting={greeting} setup={setup} recentProducts={products.data} />;
}
