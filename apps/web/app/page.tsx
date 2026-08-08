'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BootScreen } from '@/components/common/boot-screen';
import { useSession } from '@/components/session/session-provider';

/**
 * Rota de entrada do renderer.
 *
 * E o `index.html` que o Electron carrega. O destino depende da sessao, que so
 * e conhecida no cliente - por isso o redirecionamento acontece aqui e nao mais
 * com `redirect()` de servidor, que o static export nao executa.
 */
export default function HomePage() {
  const router = useRouter();
  const { phase, session, setupRequired } = useSession();

  useEffect(() => {
    if (phase === 'loading') {
      return;
    }

    // Instalacao nova: nao ha o que autenticar antes de existir um dono.
    if (setupRequired) {
      router.replace('/setup');
      return;
    }

    if (phase === 'anonymous' || !session) {
      router.replace('/login');
      return;
    }

    router.replace(session.organization.onboardingCompletedAt ? '/dashboard' : '/onboarding');
  }, [phase, session, setupRequired, router]);

  return <BootScreen />;
}
