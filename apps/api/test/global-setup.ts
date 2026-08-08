import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './setup-env';

/**
 * Cria/atualiza o schema do banco de testes uma unica vez por execucao.
 * `db push` e suficiente aqui: o que importa e a forma final do schema.
 */
export default function globalSetup(): void {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
