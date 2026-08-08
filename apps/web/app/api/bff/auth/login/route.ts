import { NextResponse, type NextRequest } from 'next/server';
import type { LoginResponseDto } from '@hub/shared';
import { apiUrl } from '@/lib/api/config';
import { applySessionCookies } from '@/lib/auth/cookies';

/**
 * Login: os tokens sao consumidos aqui e nunca chegam ao browser.
 * A resposta devolve apenas o destino sugerido apos entrar.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: 'Requisicao invalida' }, { status: 400 });
  }

  const upstream = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!upstream.ok) {
    const error = (await upstream.json().catch(() => ({}))) as { message?: string };

    return NextResponse.json(
      { message: error.message ?? 'Nao foi possivel entrar' },
      { status: upstream.status },
    );
  }

  const session = (await upstream.json()) as LoginResponseDto;

  const response = NextResponse.json({
    // Quem ainda nao concluiu o onboarding vai direto para ele.
    redirectTo: session.organization.onboardingCompletedAt ? null : '/onboarding',
    user: { name: session.user.name, email: session.user.email },
  });

  applySessionCookies(response, session);

  return response;
}
