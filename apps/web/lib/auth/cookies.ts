import type { NextResponse } from 'next/server';

/**
 * Estrategia de sessao:
 *  - access e refresh token vivem em cookies HttpOnly, inacessiveis ao JS;
 *  - o cookie de access expira junto com o token, entao "cookie ausente" ja
 *    significa "token expirado" e dispara o refresh no middleware;
 *  - o browser nunca fala com a API diretamente: tudo passa por /api/bff.
 */
export const ACCESS_TOKEN_COOKIE = 'hub_at';
export const REFRESH_TOKEN_COOKIE = 'hub_rt';

/** Marcador legivel pelo JS apenas para saber que existe sessao (sem segredo). */
export const SESSION_HINT_COOKIE = 'hub_session';

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const isSecure = process.env.COOKIE_SECURE === 'true';

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function applySessionCookies(response: NextResponse, tokens: SessionTokens): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.expiresIn,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });

  response.cookies.set(SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_HINT_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: name !== SESSION_HINT_COOKIE,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
