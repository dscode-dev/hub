'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
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
  /*
   * Uma vez que o wizard apareceu, a pagina para de vigiar `setupRequired`.
   *
   * O proprio wizard zera essa flag ao concluir - ele cria o dono e entra na
   * conta. Sem esta trava, o guard interpretaria o sucesso como "nao havia nada
   * para configurar" e desmontaria o wizard no meio do login.
   */
  const wizardStarted = useRef(false);

  if (setupRequired === true) {
    wizardStarted.current = true;
  }

  useEffect(() => {
    if (phase === 'loading' || wizardStarted.current) {
      return;
    }

    if (setupRequired === false) {
      router.replace('/login');
    }
  }, [phase, setupRequired, router]);

  if (!wizardStarted.current && (phase === 'loading' || setupRequired !== true)) {
    return <BootScreen message="Preparando a instalacao..." />;
  }

  return (
    /*
     * `overflow-x-hidden` em vez de `overflow-hidden`: o corte serve para o
     * fundo decorativo, mas os passos variam de altura e alguns passam da tela
     * em janela baixa. Cortar na vertical deixaria o topo do formulario
     * inalcancavel.
     */
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden px-4 py-8">
      <div className="auth-backdrop absolute inset-0" aria-hidden="true" />
      <div className="auth-grid absolute inset-0" aria-hidden="true" />

      {/*
       * `m-auto` centraliza verticalmente sobrando espaco e simplesmente para
       * de centralizar quando nao sobra - diferente de `items-center`, que
       * empurraria o topo para fora da area rolavel.
       */}
      <div className="relative m-auto w-full max-w-2xl">
        <SetupWizard />
      </div>
    </main>
  );
}
