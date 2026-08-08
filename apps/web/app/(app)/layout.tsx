import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { requireSession } from '@/lib/session';

/**
 * Layout da area logada. Resolve a sessao uma unica vez por navegacao e
 * garante que ninguem entre nos modulos antes de concluir o onboarding.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (!session.organization.onboardingCompletedAt) {
    redirect('/onboarding');
  }

  return <AppShell session={session}>{children}</AppShell>;
}
