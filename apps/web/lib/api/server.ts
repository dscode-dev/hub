import 'server-only';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { apiUrl } from './config';
import { ApiError, toApiError } from './errors';

/**
 * Cliente usado por Server Components.
 *
 * Nao renova tokens: o middleware ja garante um access token valido antes de a
 * pagina renderizar. Se ainda assim vier 401, o erro sobe e a pagina redireciona.
 */
export async function serverFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    throw new ApiError(401, 'Sessao nao encontrada');
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${accessToken}`,
    },
    // Dados operacionais mudam a todo momento; nada de cache implicito.
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
