'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MAIN_NAV, isActiveRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegacao principal" className="flex flex-col gap-0.5">
      {MAIN_NAV.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-brand-50 font-medium text-brand-700'
                : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
            )}
          >
            <Icon
              className={cn(
                'size-[18px] shrink-0',
                active ? 'text-brand-600' : 'text-foreground-subtle',
              )}
            />
            <span className="truncate">{item.label}</span>

            {!item.ready ? (
              <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
                em breve
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
