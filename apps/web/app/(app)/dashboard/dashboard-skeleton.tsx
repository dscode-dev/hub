import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton no formato da tela final, para a transicao nao "pular". */
export function DashboardSkeleton({ greeting }: { greeting: string }) {
  return (
    <div>
      <p className="text-sm text-foreground-muted">Ola, {greeting}</p>
      <Skeleton className="mt-2 h-8 w-72" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
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
