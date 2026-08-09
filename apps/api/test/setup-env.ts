/**
 * Ambiente dos testes de integracao.
 *
 * Aponta para um SQLite temporario, nunca para o banco de desenvolvimento.
 * Carregado antes de qualquer import de aplicacao - e uma vez por arquivo de
 * teste, o que da a cada suite um banco proprio.
 */
import { createSuiteDatabase } from './test-database';

process.env.DATABASE_URL = createSuiteDatabase();
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-com-mais-de-32-caracteres';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '900';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '2592000';
process.env.SWAGGER_ENABLED = 'false';
