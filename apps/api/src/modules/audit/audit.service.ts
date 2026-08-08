import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuditAction, AuditEntity } from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface AuditRecordInput {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Registro de auditoria simples e sincrono (mesma transacao logica da acao).
 * Falha ao auditar nunca derruba a operacao de negocio - apenas loga.
 * Quando houver volume, trocar por fila/outbox sem mudar esta interface.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar auditoria ${input.action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
