import { Module } from '@nestjs/common';
import { DatabaseBackupService } from './database-backup.service';
import { SystemController } from './system.controller';

@Module({
  controllers: [SystemController],
  providers: [DatabaseBackupService],
  exports: [DatabaseBackupService],
})
export class SystemModule {}
