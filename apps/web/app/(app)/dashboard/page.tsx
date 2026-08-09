'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardMetricsDto, Paginated, ProductDto } from '@hub/shared';
import { ErrorState } from '@/components/common/error-state';
import { useSession } from '@/components/session/session-provider';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { ActivationPanel } from './activation-panel';
import { DashboardOverview } from './dashboard-overview';
import { DashboardSkeleton } from './dashboard-skeleton';
import type { SetupStatus } from './types';

interface DashboardData {
  setup: SetupStatus;
  recentProducts: ProductDto[];
  metrics: DashboardMetricsDto;
}

export default function DashboardPage() {
  const { session } = useSession();
  const firstName = session?.user.name.split(' ')[0] ?? '';

  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);

    try {
      const [setup, products, metrics] = await Promise.all([
        apiClient.get<SetupStatus>('/organizations/me/setup-status'),
        apiClient.get<Paginated<ProductDto>>(
          '/products?pageSize=5&sortBy=createdAt&sortOrder=desc',
        ),
        apiClient.get<DashboardMetricsDto>('/dashboard/metrics'),
      ]);

      setData({ setup, recentProducts: products.data, metrics });
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return (
      <ErrorState
        description="Nao conseguimos carregar o resumo da sua operacao."
        action={
          <Button type="button" onClick={() => void load()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (!data) {
    return <DashboardSkeleton greeting={firstName} />;
  }

  /*
   * Regra da tela: sem dados, nao mostramos cards com zero.
   * Um painel de ativacao vale mais do que um dashboard vazio.
   */
  if (data.setup.productsCount === 0) {
    return <ActivationPanel greeting={firstName} setup={data.setup} />;
  }

  return (
    <DashboardOverview
      greeting={firstName}
      setup={data.setup}
      recentProducts={data.recentProducts}
      metrics={data.metrics}
    />
  );
}
