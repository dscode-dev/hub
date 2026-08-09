'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS, isActiveRoute } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegacao principal" className="flex flex-col gap-6">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? `grupo-${index}`} className="flex flex-col gap-1">
          {group.label ? (
            <h2 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
              {group.label}
            </h2>
          ) : null}

          {group.items.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-2 text-sm transition-all',
                  active
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
                  // Modulo ausente continua clicavel, mas nao compete por atencao.
                  !item.ready && !active && 'text-foreground-subtle',
                )}
              >
                {/* Marca a rota ativa mesmo para quem nao distingue a cor de fundo. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />

                <Icon
                  className={cn(
                    'size-[18px] shrink-0 transition-colors',
                    active
                      ? 'text-brand-600'
                      : 'text-foreground-subtle group-hover:text-foreground-muted',
                  )}
                />
                <span className="truncate">{item.label}</span>

                {!item.ready ? (
                  <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
                    em breve
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
