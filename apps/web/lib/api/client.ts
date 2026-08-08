import { getAccessToken, refreshAccessToken } from '@/lib/auth/access-token';
import { apiUrl } from './config';
import { ApiError, toApiError } from './errors';

/**
 * Cliente HTTP do renderer.
 *
 * Fala direto com o NestJS local em loopback - no desktop nao existe mais o
 * BFF do Next. O access token e injetado aqui, e um 401 dispara uma unica
 * tentativa de renovacao antes de propagar o erro.
 */

interface RequestOptions extends RequestInit {
  /** Interno: impede repetir o refresh em looping. */
  retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retried, ...init } = options;
  const token = getAccessToken();

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new ApiError(0, 'Nao conseguimos falar com o servico da Plataforma Hub.');
  }

  if (response.status === 401 && !retried) {
    const renewed = await refreshAccessToken();

    if (renewed) {
      return request<T>(path, { ...options, retried: true });
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** Upload de arquivo: o browser define o content-type com o boundary correto. */
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
};

export { ApiError };
