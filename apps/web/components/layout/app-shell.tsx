import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { SessionDto } from '@hub/shared';
import { HubLogo } from '@/components/brand/logo';
import { GlobalSearch } from './global-search';
import { MobileNav } from './mobile-nav';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

/**
 * Estrutura da area logada: sidebar fixa no desktop, painel no mobile.
 * Server Component - a sessao ja chega resolvida do layout.
 */
export function AppShell({
  session,
  children,
}: {
  session: SessionDto;
  children: React.ReactNode;
}) {
  const organizationName = session.organization.tradeName || session.organization.name;

  return (
    <div className="min-h-dvh bg-surface-subtle">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/dashboard" className="px-2 py-1">
          <HubLogo />
        </Link>

        <SidebarNav />

        <div className="mt-auto rounded-lg bg-surface-muted p-3">
          <p className="text-xs font-medium text-foreground">{organizationName}</p>
          <p className="mt-0.5 text-xs text-foreground-subtle">Plano inicial</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <MobileNav />

          <Link href="/dashboard" className="lg:hidden">
            <HubLogo showWordmark={false} />
          </Link>

          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="truncate text-sm font-medium text-foreground">
              {organizationName}
            </span>
          </div>

          <div className="ml-auto flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <GlobalSearch />

            <button
              type="button"
              aria-label="Notificacoes"
              title="Notificacoes (em breve)"
              className="relative rounded-lg p-2 text-foreground-muted transition-colors hover:bg-surface-muted"
            >
              <Bell className="size-5" />
            </button>

            <UserMenu user={session.user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
