import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  /** Interface de rede. Loopback por padrao: a API local nao vai para a LAN. */
  host: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
}

/** Origem do renderer empacotado (esquema proprio registrado pelo Electron). */
const DESKTOP_ORIGIN = 'hub://app';

export interface AuthConfig {
  accessSecret: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? '127.0.0.1',
    corsOrigins: buildCorsOrigins(),
    swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  }),
);

/**
 * Monta a lista de origens permitidas.
 *
 * Quando iniciado pelo Electron (HUB_DESKTOP=1), a origem do renderer
 * empacotado entra automaticamente - assim o app desktop funciona sem exigir
 * que o instalador escreva um .env na maquina do cliente.
 */
function buildCorsOrigins(): string[] {
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.HUB_DESKTOP === '1' && !configured.includes(DESKTOP_ORIGIN)) {
    configured.push(DESKTOP_ORIGIN);
  }

  return configured;
}

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN ?? 900),
    refreshExpiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN ?? 2592000),
  }),
);
