import { getBridge } from '@/lib/desktop/bridge';

/**
 * Endereco da API local.
 *
 * Fonte unica: no desktop vem do Main Process (que conhece a porta real do
 * backend que ele mesmo subiu); no navegador, de NEXT_PUBLIC_API_URL. Nenhum
 * componente monta URL de API por conta propria.
 */
const FALLBACK_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001/api/v1';

export function getApiBaseUrl(): string {
  return getBridge()?.backend.baseUrl ?? FALLBACK_API_URL;
}

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
