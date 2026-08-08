'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGuard } from '@/components/session/auth-guard';

/**
 * Layout da area logada.
 *
 * Antes do static export a sessao era resolvida no servidor; agora o AuthGuard
 * faz o mesmo papel no cliente e so libera o shell com sessao valida e
 * onboarding concluido.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{(session) => <AppShell session={session}>{children}</AppShell>}</AuthGuard>;
}
