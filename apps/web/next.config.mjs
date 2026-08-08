/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O pacote compartilhado e publicado como CommonJS compilado; nada a transpilar,
  // mas mantemos a lista explicita para quando ele passar a exportar TS direto.
  transpilePackages: ['@hub/shared'],
  // Links quebrados viram erro de compilacao, nao bug em producao.
  typedRoutes: true,
};

export default nextConfig;
