/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * Runtime desktop: o renderer e um export estatico carregado pelo Electron a
   * partir do disco. Nao existe servidor Next em producao, portanto nada de
   * SSR, Server Actions, Route Handlers ou middleware - a aplicacao se comporta
   * como uma SPA que consome o NestJS local.
   */
  output: 'export',

  // Sem servidor nao ha otimizacao de imagem sob demanda.
  images: { unoptimized: true },

  transpilePackages: ['@hub/shared'],

  // Links quebrados viram erro de compilacao, nao bug em producao.
  typedRoutes: true,
};

export default nextConfig;
