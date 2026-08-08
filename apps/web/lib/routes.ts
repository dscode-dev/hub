import type { Route } from 'next';

/**
 * Construcao de rotas.
 *
 * Rotas de detalhe usam query param (`/products/detail?id=...`) em vez de
 * segmento dinamico: com `output: 'export'` um segmento `[id]` exigiria
 * `generateStaticParams`, e os ids so existem em runtime.
 */

/** Monta uma rota com query string preservando o tipo `Route`. */
export function routeWithQuery(pathname: string, params: URLSearchParams): Route {
  const query = params.toString();

  return (query ? `${pathname}?${query}` : pathname) as Route;
}

export function productDetailRoute(id: string): Route {
  return `/products/detail?id=${encodeURIComponent(id)}` as Route;
}

export function productEditRoute(id: string): Route {
  return `/products/edit?id=${encodeURIComponent(id)}` as Route;
}

/**
 * Valida um destino vindo de fora (query string) antes de navegar.
 * Rejeita URLs absolutas e protocol-relative, que seriam um vetor de open
 * redirect. Unico ponto do app autorizado a transformar string em rota.
 */
export function internalRoute(target: string | null | undefined, fallback: Route): Route {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return fallback;
  }

  return target as Route;
}
