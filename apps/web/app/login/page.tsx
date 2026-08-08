import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HubLogo } from '@/components/brand/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Entrar',
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      {/* Camadas decorativas: degrade da marca + malha quadriculada. */}
      <div className="auth-backdrop absolute inset-0" aria-hidden="true" />
      <div className="auth-grid absolute inset-0" aria-hidden="true" />

      {/*
        A composicao sobe um pouco em relacao ao centro geometrico: com o
        rodape abaixo do cartao, o centro optico fica acima do centro real.
      */}
      <div className="relative w-full max-w-md sm:-translate-y-4">
        <header className="mb-9 flex flex-col items-center gap-5 text-center">
          <HubLogo size="xl" />

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Entre na sua conta
            </h1>
            <p className="text-sm text-foreground-muted">
              Produtos, estoque, vendas e financeiro em um so lugar.
            </p>
          </div>
        </header>

        <div className="auth-card rounded-2xl border border-line bg-surface p-7 sm:p-8">
          {/* useSearchParams exige boundary de Suspense no static export. */}
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-7 text-center text-xs text-foreground-subtle">
          Ao entrar voce concorda com os termos de uso da Plataforma Hub.
        </p>
      </div>
    </main>
  );
}
