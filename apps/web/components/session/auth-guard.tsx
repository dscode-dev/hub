'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { SessionDto } from '@hub/shared';
import { BootScreen } from '@/components/common/boot-screen';
import { useSession } from './session-provider';

/**
 * Guarda de rota client-side.
 *
 * Faz o papel que o middleware do Next fazia antes do static export:
 * bloqueia a area logada, empurra quem nao tem sessao para o login e quem nao
 * concluiu o onboarding para o onboarding.
 *
 * O redirecionamento acontece em efeito (nao durante a renderizacao) para nao
 * atualizar o router enquanto outro componente ainda esta renderizando.
 */
export function AuthGuard({
  children,
  requireOnboarding = true,
}: {
  children: (session: SessionDto) => React.ReactNode;
  /** false na propria tela de onboarding, que precisa rodar antes de concluido. */
  requireOnboarding?: boolean;
}) {
  const router = useRouter();
  const { phase, session } = useSession();

  const needsOnboarding =
    requireOnboarding && session !== null && !session.organization.onboardingCompletedAt;

  useEffect(() => {
    if (phase === 'anonymous') {
      router.replace('/login');
      return;
    }

    if (needsOnboarding) {
      router.replace('/onboarding');
    }
  }, [phase, needsOnboarding, router]);

  if (phase !== 'authenticated' || !session || needsOnboarding) {
    return <BootScreen />;
  }

  return <>{children(session)}</>;
}
