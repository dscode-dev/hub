/**
 * Testes rodam sempre contra o banco de testes, nunca contra o de desenvolvimento.
 * Este arquivo e carregado antes de qualquer import de aplicacao.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '..', '.env') });

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://hub:hub@localhost:5442/plataforma_hub_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-com-mais-de-32-caracteres';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '900';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '2592000';
process.env.SWAGGER_ENABLED = 'false';
