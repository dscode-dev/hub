import { NextResponse, type NextRequest } from 'next/server';
import { apiUrl } from '@/lib/api/config';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  applySessionCookies,
  clearSessionCookies,
} from '@/lib/auth/cookies';
import { refreshSession } from '@/lib/auth/refresh';

/**
 * BFF: unico caminho do browser ate a API.
 *
 * O cliente nunca ve tokens - ele envia cookies HttpOnly, e este handler
 * traduz para o header Authorization. Sob 401, tenta renovar a sessao uma vez
 * e regravar os cookies antes de devolver o erro.
 */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'set-cookie',
]);

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const targetPath = `/${path.join('/')}${request.nextUrl.search}`;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : Buffer.from(await request.arrayBuffer());

  const forward = (token: string | undefined) =>
    fetch(apiUrl(targetPath), {
      method: request.method,
      headers: buildHeaders(request, token),
      body,
      cache: 'no-store',
    });

  let upstream = await forward(accessToken);
  let renewed: Awaited<ReturnType<typeof refreshSession>> = null;

  if (upstream.status === 401 && refreshToken) {
    renewed = await refreshSession(refreshToken);

    if (renewed) {
      upstream = await forward(renewed.accessToken);
    }
  }

  const response = await toNextResponse(upstream);

  if (renewed) {
    applySessionCookies(response, renewed);
  } else if (upstream.status === 401) {
    clearSessionCookies(response);
  }

  return response;
}

function buildHeaders(request: NextRequest, token: string | undefined): Headers {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');

  if (contentType) {
    headers.set('content-type', contentType);
  }

  headers.set('accept', 'application/json');

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  return headers;
}

async function toNextResponse(upstream: Response): Promise<NextResponse> {
  const payload = await upstream.arrayBuffer();
  const headers = new Headers();

  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return new NextResponse(payload.byteLength ? payload : null, {
    status: upstream.status,
    headers,
  });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
