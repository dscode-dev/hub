import { createServer } from 'node:net';
import { BACKEND_HOST } from '../shared/config';
import { createLogger } from '../shared/logger';

const log = createLogger('port');

/**
 * Escolhe a porta em que o backend vai escutar.
 *
 * Tenta a preferida primeiro para manter o ambiente previsivel (log, Swagger em
 * dev, depuracao). Se ela estiver ocupada - outro app, um container, uma
 * instancia antiga que nao morreu - pede uma porta livre ao sistema em vez de
 * deixar o backend abortar com EADDRINUSE.
 *
 * A porta e sempre em loopback: o backend nunca fica exposto na rede local.
 */
export async function resolveBackendPort(preferred: number): Promise<number> {
  if (await isFree(preferred)) {
    return preferred;
  }

  const fallback = await findFreePort();
  log.warn('Porta preferida ocupada; usando outra', { preferred, escolhida: fallback });

  return fallback;
}

function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, BACKEND_HOST);
  });
}

/**
 * Porta 0 faz o SO escolher uma livre. Ha uma janela entre fechar aqui e o
 * backend abrir, mas o intervalo e minimo e a alternativa (varrer portas na mao)
 * tem exatamente a mesma corrida.
 */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();

      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Nao foi possivel obter uma porta livre.')));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });

    server.listen(0, BACKEND_HOST);
  });
}
