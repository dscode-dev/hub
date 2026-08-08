import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente unico de acesso ao banco local.
 *
 * Instancia unica no processo: o NestJS e o unico a falar com o SQLite, e o
 * Renderer nunca toca no arquivo. Isso ja elimina a maior fonte de contencao
 * de um banco embarcado.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private ready = false;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.applyPragmas();

    this.ready = true;
    this.logger.log('Prisma conectado ao banco local');
  }

  async onModuleDestroy(): Promise<void> {
    this.ready = false;

    /*
     * Checkpoint antes de sair: move o conteudo do WAL para o arquivo
     * principal, deixando `hub.db` consistente por si so. Sem isso, um backup
     * feito por copia simples poderia nascer sem as ultimas transacoes.
     */
    await this.checkpoint().catch((error: unknown) => {
      this.logger.warn(`Checkpoint final falhou: ${describe(error)}`);
    });

    await this.$disconnect();
    this.logger.log('Banco local encerrado');
  }

  /**
   * PRAGMAs escolhidos (e apenas estes):
   *
   * - `journal_mode=WAL`: leitura e escrita deixam de se bloquear. Numa tela de
   *   PDV, consultar produtos enquanto uma venda grava e o caso normal.
   * - `foreign_keys=ON`: o SQLite ignora chave estrangeira por padrao. Sem
   *   isso, `onDelete: Cascade`/`SetNull` do schema seriam decorativos.
   * - `busy_timeout`: em vez de falhar na hora, espera o lock por alguns
   *   segundos - suficiente para escritas concorrentes do proprio backend.
   * - `synchronous=NORMAL`: seguro com WAL e bem mais rapido que FULL em disco
   *   de cliente. Perda possivel apenas em queda de energia, nao em crash do app.
   */
  private async applyPragmas(): Promise<void> {
    /*
     * `$queryRawUnsafe` e nao `$executeRawUnsafe`: varios PRAGMAs devolvem o
     * valor aplicado como linha, e o executeRaw recusa comandos que retornam
     * resultado ("Execute returned results, which is not allowed in SQLite").
     */
    await this.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    await this.$queryRawUnsafe('PRAGMA foreign_keys = ON');
    await this.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
    await this.$queryRawUnsafe('PRAGMA synchronous = NORMAL');

    this.logger.log('PRAGMAs aplicados (WAL, foreign_keys, busy_timeout, synchronous)');
  }

  /** Consolida o WAL no arquivo principal. Usado no shutdown e no backup. */
  async checkpoint(): Promise<void> {
    await this.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
  }

  /** Verificacao usada pelo /health: precisa tocar o banco de verdade. */
  async isHealthy(): Promise<boolean> {
    if (!this.ready) {
      return false;
    }

    try {
      await this.$queryRawUnsafe('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`Banco indisponivel: ${describe(error)}`);
      return false;
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
