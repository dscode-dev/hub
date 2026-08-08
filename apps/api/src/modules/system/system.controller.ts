import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '@/modules/audit/audit.service';
import { DatabaseBackupService, type BackupFileInfo } from './database-backup.service';

/**
 * Operacoes da instalacao local.
 *
 * Backup e uma acao administrativa sobre os dados da empresa, entao exige
 * sessao e papel elevado - mesmo o backend so escutando em loopback.
 */
@ApiTags('system')
@Controller('system')
@Roles('OWNER', 'ADMIN')
export class SystemController {
  constructor(
    private readonly backupService: DatabaseBackupService,
    private readonly auditService: AuditService,
  ) {}

  @Post('backup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Gera um backup do banco local',
    description:
      'Consolida o WAL e copia o arquivo para o diretorio de backups da instalacao.',
  })
  async createBackup(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.backupService.create();

    await this.auditService.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'DATABASE_BACKUP_CREATED',
      entity: 'Database',
      entityId: result.filename,
      metadata: { sizeBytes: result.sizeBytes },
    });

    // O diretorio nao volta para o cliente: e caminho local do sistema.
    return {
      filename: result.filename,
      sizeBytes: result.sizeBytes,
      createdAt: result.createdAt,
    };
  }

  @Get('backups')
  @ApiOperation({ summary: 'Lista os backups disponiveis nesta instalacao' })
  listBackups(): { data: BackupFileInfo[] } {
    return { data: this.backupService.list() };
  }
}
