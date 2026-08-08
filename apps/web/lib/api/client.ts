import { ApiError, toApiError } from './errors';

/**
 * Cliente de browser. Sempre passa pelo BFF (/api/bff/*), nunca pela API direto:
 * e o BFF que conhece os tokens.
 */
const BFF_PREFIX = '/api/bff';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BFF_PREFIX}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await toApiError(response);

    // Sessao encerrada em outra aba ou expirada de vez: volta para o login.
    if (error.isUnauthorized && typeof window !== 'undefined') {
      window.location.href = '/login';
    }

    throw error;
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
