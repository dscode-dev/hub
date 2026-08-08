import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  applySessionCookies,
  clearSessionCookies,
} from '@/lib/auth/cookies';
import { refreshSession } from '@/lib/auth/refresh';

const PUBLIC_ROUTES = ['/login'];

/**
 * Porteiro da aplicacao.
 *
 * O cookie de access token expira junto com o token, entao sua ausencia e o
 * sinal para renovar. Renovar aqui (e nao no Server Component) e o que permite
 * gravar os novos cookies, ja que Server Components nao podem escrever cookies.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (accessToken) {
    if (isPublicRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  if (refreshToken) {
    const session = await refreshSession(refreshToken);

    if (session) {
      const target = isPublicRoute ? new URL('/dashboard', request.url) : null;
      const response = target ? NextResponse.redirect(target) : NextResponse.next();
      applySessionCookies(response, session);

      return response;
    }

    // Refresh invalido: limpa a sessao e manda para o login.
    const response = isPublicRoute
      ? NextResponse.next()
      : NextResponse.redirect(buildLoginUrl(request));
    clearSessionCookies(response);

    return response;
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  return NextResponse.redirect(buildLoginUrl(request));
}

function buildLoginUrl(request: NextRequest): URL {
  const loginUrl = new URL('/login', request.url);
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  // Preserva o destino para devolver o usuario exatamente onde ele estava.
  if (target && target !== '/') {
    loginUrl.searchParams.set('next', target);
  }

  return loginUrl;
}

export const config = {
  matcher: [
    /*
     * Todas as rotas de pagina. Ficam de fora:
     *  - /api/bff (trata a propria autenticacao e o refresh sob 401)
     *  - assets estaticos do Next
     */
    '/((?!api/bff|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
