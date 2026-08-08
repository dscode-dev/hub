import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HubLogo } from '@/components/brand/logo';
import { requireSession } from '@/lib/session';
import { OnboardingWizard } from './onboarding-wizard';

export const metadata: Metadata = {
  title: 'Primeiros passos',
};

export default async function OnboardingPage() {
  const session = await requireSession();

  // Onboarding e etapa unica: quem ja passou nao volta para ela.
  if (session.organization.onboardingCompletedAt) {
    redirect('/dashboard');
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
