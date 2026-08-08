'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BootScreen } from '@/components/common/boot-screen';
import { useSession } from '@/components/session/session-provider';
import { SetupWizard } from './setup-wizard';

/**
 * Primeiro acesso da instalacao.
 *
 * So existe enquanto a instalacao nao tiver um usuario responsavel. Quem chega
 * aqui depois disso e devolvido ao login - a rota do backend tambem recusa,
 * entao a checagem daqui e conveniencia de navegacao, nao a protecao.
 */
export default function SetupPage() {
  const router = useRouter();
  const { phase, setupRequired } = useSession();

  useEffect(() => {
    if (phase !== 'loading' && setupRequired === false) {
      router.replace('/login');
    }
  }, [phase, setupRequired, router]);

  if (phase === 'loading' || setupRequired !== true) {
    return <BootScreen message="Preparando a instalacao..." />;
  }

  return (
    <main className="relative min-h-dvh overflow-hidden px-4 py-8">
      <div className="auth-backdrop absolute inset-0" aria-hidden="true" />
      <div className="auth-grid absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-2xl">
        <SetupWizard />
      </div>
    </main>
  );
}
