'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { HubLogo } from '@/components/brand/logo';
import { SidebarNav } from './sidebar-nav';

/** Mesma navegacao do desktop, em painel deslizante no mobile. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="rounded-lg p-2 text-foreground-muted transition-colors hover:bg-surface-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-brand-950/25"
          />

          <div className="relative flex h-full w-72 max-w-[85vw] flex-col gap-6 border-r border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <HubLogo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-2 text-foreground-muted transition-colors hover:bg-surface-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
