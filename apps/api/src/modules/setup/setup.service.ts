import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACCEPTED_LOGO_MIME,
  MAX_LOGO_BYTES,
  type SetupResultDto,
  type SetupStatusDto,
} from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { serializeStringList } from '@/common/utils/string-list';
import { AuthService } from '@/modules/auth/auth.service';
import type { CreateSetupDto } from './dto/create-setup.dto';

/**
 * Primeiro acesso da instalacao.
 *
 * Regra inegociavel: esta rota e publica (nao existe usuario para autenticar
 * ainda), portanto so pode funcionar UMA vez. Depois que houver um OWNER, ela
 * fica permanentemente fechada.
 *
 * A garantia nao vem de um `if` no service - vem do banco. Ver `runExclusively`.
 */
const SINGLETON_ID = 'singleton';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<SetupStatusDto> {
    const marker = await this.prisma.instanceSetup.findUnique({ where: { id: SINGLETON_ID } });

    if (marker) {
      return { required: false, completedAt: marker.completedAt.toISOString() };
    }

    /*
     * Sem marcador, a verdade e a existencia de um OWNER: cobre bancos criados
     * por seed ou restaurados de backup, que nunca passaram por este fluxo.
     */
    const owners = await this.prisma.user.count({ where: { role: 'OWNER' } });

    return { required: owners === 0, completedAt: null };
  }

  async run(dto: CreateSetupDto): Promise<SetupResultDto> {
    const logo = this.validateLogo(dto.company.logo ?? null);
    const passwordHash = await AuthService.hashPassword(dto.owner.password);

    try {
      /*
       * Sem `isolationLevel`: o SQLite nao expoe niveis de isolamento porque
       * serializa escritas por natureza - so existe um escritor por vez. A
       * garantia que o Postgres obtinha com Serializable ja e o comportamento
       * padrao aqui, e o INSERT do marcador continua sendo a exclusao mutua.
       */
      return await this.prisma.$transaction(async (tx) => {
          /*
           * 1. Reserva do marcador ANTES de qualquer escrita.
           *
           * `id` tem valor fixo, entao duas requisicoes simultaneas colidem na
           * mesma chave primaria e apenas uma sobrevive - a outra recebe P2002
           * e toda a transacao dela e desfeita. E este INSERT, e nao a leitura
           * abaixo, que elimina a janela de corrida.
           */
          await tx.instanceSetup.create({
            data: {
              id: SINGLETON_ID,
              // Preenchidos depois; o INSERT existe para reservar a chave.
              organizationId: '00000000-0000-4000-8000-000000000000',
              userId: '00000000-0000-4000-8000-000000000000',
            },
          });

          // 2. Estado real: nenhum OWNER pode existir, com ou sem marcador.
          const owners = await tx.user.count({ where: { role: 'OWNER' } });

          if (owners > 0) {
            throw new ConflictException('Esta instalacao ja foi configurada.');
          }

          const emailTaken = await tx.user.findUnique({
            where: { email: dto.owner.email },
            select: { id: true },
          });

          if (emailTaken) {
            throw new ConflictException('Ja existe um usuario com esse e-mail.');
          }

          const organization = await tx.organization.create({
            data: {
              name: dto.company.name,
              tradeName: dto.company.tradeName ?? null,
              document: dto.company.document ?? null,
              email: dto.company.email ?? null,
              phone: dto.company.phone ?? null,
              logo,
              segments: serializeStringList(dto.company.segments),
              operationGoals: serializeStringList(dto.company.operationGoals),
              addressZipCode: dto.company.address?.zipCode ?? null,
              addressStreet: dto.company.address?.street ?? null,
              addressNumber: dto.company.address?.number ?? null,
              addressComplement: dto.company.address?.complement ?? null,
              addressDistrict: dto.company.address?.district ?? null,
              addressCity: dto.company.address?.city ?? null,
              addressState: dto.company.address?.state ?? null,
              addressReference: dto.company.address?.reference ?? null,
              // O wizard ja coletou tudo: nao repetimos o onboarding depois.
              onboardingCompletedAt: new Date(),
            },
          });

          const user = await tx.user.create({
            data: {
              organizationId: organization.id,
              name: dto.owner.name,
              email: dto.owner.email,
              passwordHash,
              role: 'OWNER',
            },
          });

          const marker = await tx.instanceSetup.update({
            where: { id: SINGLETON_ID },
            data: { organizationId: organization.id, userId: user.id },
          });

          await tx.auditLog.create({
            data: {
              organizationId: organization.id,
              userId: user.id,
              action: 'INSTANCE_SETUP_COMPLETED',
              entity: 'Organization',
              entityId: organization.id,
              metadata: {
                segments: dto.company.segments ?? [],
                hasLogo: logo !== null,
              },
            },
          });

          return {
            organizationId: organization.id,
            userId: user.id,
            completedAt: marker.completedAt.toISOString(),
          } satisfies SetupResultDto;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn('Tentativa de setup em instalacao ja configurada');
        throw new ConflictException('Esta instalacao ja foi configurada.');
      }

      throw error;
    }
  }

  /**
   * Valida a logo recebida como data URL.
   * Conteudo enviado por rota publica: tipo e tamanho sao checados no servidor,
   * nunca apenas no formulario.
   */
  private validateLogo(logo: string | null): string | null {
    if (!logo) {
      return null;
    }

    const match = /^data:([a-z+/-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(logo);

    if (!match) {
      throw new BadRequestException('Formato de logo invalido.');
    }

    const [, mime, base64] = match;

    if (!mime || !ACCEPTED_LOGO_MIME.includes(mime.toLowerCase())) {
      throw new BadRequestException('Use uma imagem PNG, JPEG, WEBP ou SVG.');
    }

    // Tamanho real dos bytes, nao o comprimento da string base64.
    const bytes = Math.floor(((base64?.length ?? 0) * 3) / 4);

    if (bytes > MAX_LOGO_BYTES) {
      throw new BadRequestException(
        `A logo deve ter no maximo ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`,
      );
    }

    return logo;
  }
}
