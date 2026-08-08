import 'server-only';
import { redirect } from 'next/navigation';
import type { SessionDto } from '@hub/shared';
import { serverFetch } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';

/**
 * Sessao do request atual. O middleware ja garantiu um access token valido;
 * aqui apenas materializamos usuario + organizacao para a UI.
 */
export async function requireSession(): Promise<SessionDto> {
  try {
    return await serverFetch<SessionDto>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      redirect('/login');
    }

    throw error;
  }
}
