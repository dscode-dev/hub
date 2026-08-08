import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  swaggerEnabled: boolean;
}

export interface AuthConfig {
  accessSecret: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export const appConfig = registerAs(
  'app',
  (): AppConfig => ({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 5010),
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  }),
);

export const authConfig = registerAs(
  'auth',
  (): AuthConfig => ({
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: Number(process.env.JWT_ACCESS_EXPIRES_IN ?? 900),
    refreshExpiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN ?? 2592000),
  }),
);
