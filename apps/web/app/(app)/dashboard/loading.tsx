import { Skeleton } from '@/components/ui/skeleton';

/**
 * Fallback de navegacao da visao geral.
 *
 * Boundaries de loading ficam por rota, e nao no grupo inteiro: uma rota que
 * pode devolver 404 (detalhe de produto) precisa manter o status correto, o que
 * um loading.tsx compartilhado impediria ao iniciar o streaming cedo demais.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-8 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-[104px] rounded-xl" />
            <Skeleton className="h-[104px] rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
