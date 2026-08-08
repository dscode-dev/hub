import { Logger } from '@nestjs/common';

/**
 * Vigia do processo pai.
 *
 * O Electron encerra o backend normalmente no shutdown, mas existe um caso que
 * ele nao consegue cobrir: se o proprio Electron for morto a forca (SIGKILL,
 * "Finalizar tarefa" no Windows, crash), nenhum handler de saida roda e o
 * backend ficaria orfao segurando a porta e o banco.
 *
 * Este watchdog resolve pelo outro lado: o filho verifica se o pai continua
 * vivo e se encerra sozinho quando ele some. So e ativado quando o Electron
 * informa HUB_PARENT_PID, portanto nao afeta a execucao standalone da API.
 */
const CHECK_INTERVAL_MS = 2_000;

export function startParentWatchdog(): void {
  const parentPid = Number(process.env.HUB_PARENT_PID);

  if (!Number.isInteger(parentPid) || parentPid <= 0) {
    return;
  }

  const logger = new Logger('ParentWatchdog');
  logger.log(`Monitorando o processo pai (pid ${parentPid})`);

  const timer = setInterval(() => {
    if (!isAlive(parentPid)) {
      logger.warn('Processo pai encerrou; finalizando o backend para nao ficar orfao');
      clearInterval(timer);
      process.exit(0);
    }
  }, CHECK_INTERVAL_MS);

  // Nao segura o event loop: se o backend terminar por conta propria, tudo bem.
  timer.unref();
}

/** `kill(pid, 0)` nao envia sinal: apenas testa existencia e permissao. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
