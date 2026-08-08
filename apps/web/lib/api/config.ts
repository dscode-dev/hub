/** Base da API. Somente codigo de servidor deve importar este modulo. */
export const API_URL = process.env.API_URL ?? 'http://localhost:5010/api/v1';

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
