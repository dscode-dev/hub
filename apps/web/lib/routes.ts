import type { Route } from 'next';

/**
 * Monta uma rota com query string preservando o tipo `Route`.
 *
 * `typedRoutes` valida rotas estaticamente, mas nao tem como conferir uma URL
 * montada em runtime a partir de filtros. O pathname vem sempre de
 * `usePathname()` (ou seja, de uma rota que existe), entao a asserção esta
 * restrita a este unico ponto em vez de espalhada pelos componentes.
 */
export function routeWithQuery(pathname: string, params: URLSearchParams): Route {
  const query = params.toString();

  return (query ? `${pathname}?${query}` : pathname) as Route;
}

/**
 * Valida um destino vindo de fora (query string, resposta do BFF) antes de
 * navegar. Rejeita URLs absolutas e protocol-relative, que seriam um vetor de
 * open redirect. Unico ponto do app autorizado a transformar string em rota.
 */
export function internalRoute(target: string | null | undefined, fallback: Route): Route {
  if (!target || !target.startsWith('/') || target.startsWith('//')) {
    return fallback;
  }

  return target as Route;
}
