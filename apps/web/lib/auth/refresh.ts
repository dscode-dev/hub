import { apiUrl } from '@/lib/api/config';

export interface RefreshedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Troca um refresh token por um novo par. Retorna null quando a sessao acabou -
 * quem chama decide entre redirecionar para o login ou responder 401.
 */
export async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  try {
    const response = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as RefreshedSession;

    if (!data.accessToken || !data.refreshToken) {
      return null;
    }

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch {
    return null;
  }
}
