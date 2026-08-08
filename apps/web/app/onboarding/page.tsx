'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { HubLogo } from '@/components/brand/logo';
import { BootScreen } from '@/components/common/boot-screen';
import { useSession } from '@/components/session/session-provider';
import { OnboardingWizard } from './onboarding-wizard';

export default function OnboardingPage() {
  const router = useRouter();
  const { phase, session } = useSession();

  useEffect(() => {
    if (phase === 'anonymous') {
      router.replace('/login');
      return;
    }

    // Onboarding e etapa unica: quem ja passou nao volta para ela.
    if (session?.organization.onboardingCompletedAt) {
      router.replace('/dashboard');
    }
  }, [phase, session, router]);

  if (phase !== 'authenticated' || !session || session.organization.onboardingCompletedAt) {
    return <BootScreen />;
  }

  return (
    <main className="min-h-dvh bg-surface-subtle">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <HubLogo />
          <span className="text-sm text-foreground-subtle">{session.user.name}</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <OnboardingWizard
          defaultName={session.organization.name}
          defaultTradeName={session.organization.tradeName ?? ''}
          defaultPhone={session.organization.phone ?? ''}
        />
      </div>
    </main>
  );
}
