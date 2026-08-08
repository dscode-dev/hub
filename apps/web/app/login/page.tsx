import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HubLogo } from '@/components/brand/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Entrar',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-surface-subtle">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-100">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <HubLogo />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Entre na sua conta
              </h1>
              <p className="mt-1 text-sm text-foreground-muted">
                Gerencie produtos, estoque e vendas em um so lugar.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm shadow-brand-950/3">
            {/* useSearchParams exige boundary de Suspense no static export. */}
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-xs text-foreground-subtle">
            Ao entrar voce concorda com os termos de uso da Plataforma Hub.
          </p>
        </div>
      </div>
    </main>
  );
}
