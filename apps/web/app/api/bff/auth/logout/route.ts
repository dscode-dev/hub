import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl } from '@/lib/api/config';
import { REFRESH_TOKEN_COOKIE, clearSessionCookies } from '@/lib/auth/cookies';

/** Revoga o refresh token na API e limpa os cookies, nesta ordem. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => {
      // Falha ao revogar no servidor nao pode impedir o usuario de sair daqui.
    });
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);

  return response;
}
