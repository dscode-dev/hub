import { Skeleton } from '@/components/ui/skeleton';

export function ProductListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="hidden border-b border-line px-5 py-3 md:block">
        <Skeleton className="h-3 w-40" />
      </div>

      <ul className="divide-y divide-line">
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    </div>
  );
}
