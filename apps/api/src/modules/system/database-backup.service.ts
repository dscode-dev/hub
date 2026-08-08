import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '@/common/prisma/prisma.service';
import { resolveDatabaseFile } from '@/database/database-paths';

export interface BackupFileInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupResult extends BackupFileInfo {
  directory: string;
}

/**
 * Backup do banco local.
 *
 * Estrategia: `wal_checkpoint(TRUNCATE)` e so entao copiar o arquivo.
 *
 * Copiar `hub.db` diretamente com o WAL ativo produziria um backup incompleto -
 * as transacoes mais recentes ainda estariam no arquivo `-wal`, que a copia
 * simples ignora. O checkpoint consolida tudo no arquivo principal antes,
 * deixando um `.db` integro e autossuficiente.
 *
 * O backup roda no backend, e nao no Electron, porque so o backend sabe o
 * estado real das conexoes e consegue forcar o checkpoint.
 */
@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Diretorio de backups, irmao do diretorio de dados.
   * Fica em userData, nunca dentro do aplicativo instalado.
   */
  getBackupDirectory(): string {
    const dataDirectory = join(this.getDatabaseFile(), '..');
    // userData/data/hub.db -> userData/backups
    const directory = join(dataDirectory, '..', 'backups');

    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    return directory;
  }

  async create(): Promise<BackupResult> {
    const source = this.getDatabaseFile();

    if (!existsSync(source)) {
      throw new InternalServerErrorException('Banco de dados nao encontrado.');
    }

    const directory = this.getBackupDirectory();
    const filename = buildBackupName();
    const target = join(directory, filename);

    try {
      // Consolida o WAL antes de copiar: sem isso o backup nasce desatualizado.
      await this.prisma.checkpoint();
      copyFileSync(source, target);
    } catch (error) {
      this.logger.error(
        `Falha ao gerar backup: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException('Nao foi possivel gerar o backup.');
    }

    const stats = statSync(target);
    this.logger.log(`Backup criado: ${filename} (${stats.size} bytes)`);

    return {
      filename,
      directory,
      sizeBytes: stats.size,
      createdAt: stats.birthtime.toISOString(),
    };
  }

  /**
   * Lista os backups existentes, do mais recente para o mais antigo.
   *
   * A ordenacao por nome ja e cronologica (timestamp no prefixo). E o que uma
   * politica de retencao futura ("7 diarios, 4 semanais") vai consumir, sem
   * precisar reescrever nada aqui.
   */
  list(): BackupFileInfo[] {
    const directory = this.getBackupDirectory();

    return readdirSync(directory)
      .filter((name) => name.startsWith('hub-backup-') && name.endsWith('.db'))
      .map((filename) => {
        const stats = statSync(join(directory, filename));

        return {
          filename,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename));
  }

  private getDatabaseFile(): string {
    return resolveDatabaseFile(process.env.DATABASE_URL);
  }
}

/**
 * Nome do arquivo de backup.
 *
 * Timestamp ISO com `:` trocado por `-`: dois-pontos e caractere invalido em
 * nome de arquivo no Windows.
 */
function buildBackupName(): string {
  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, '');

  return `hub-backup-${stamp}.db`;
}
