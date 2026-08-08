import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import type { LoginResponseDto, SessionDto } from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { toOrganizationDto } from '@/modules/organizations/organization.mapper';
import type { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';
import { toAuthUserDto } from './user.mapper';

export const PASSWORD_SALT_ROUNDS = 12;

/** Mensagem unica para credencial invalida: nao revela se o e-mail existe. */
const INVALID_CREDENTIALS = 'E-mail ou senha incorretos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    });

    if (!user) {
      // Custo constante: evita descobrir e-mails validos pelo tempo de resposta.
      await compare(dto.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.active) {
      throw new UnauthorizedException('Usuario desativado. Fale com o administrador da conta.');
    }

    const tokens = await this.tokenService.issueForUser(user);

    await this.auditService.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'AUTH_LOGIN',
      entity: 'User',
      entityId: user.id,
    });

    return {
      ...tokens,
      user: toAuthUserDto(user),
      organization: toOrganizationDto(user.organization),
    };
  }

  /** Rotaciona o refresh token: o antigo e revogado ao emitir o novo. */
  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const stored = await this.tokenService.findValidRefreshToken(refreshToken);

    if (!stored) {
      throw new UnauthorizedException('Sessao expirada. Entre novamente.');
    }

    if (!stored.user.active) {
      await this.tokenService.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Usuario desativado. Fale com o administrador da conta.');
    }

    await this.tokenService.revokeRefreshToken(refreshToken);
    const tokens = await this.tokenService.issueForUser(stored.user);

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: stored.user.organizationId },
    });

    return {
      ...tokens,
      user: toAuthUserDto(stored.user),
      organization: toOrganizationDto(organization),
    };
  }

  async logout(refreshToken: string | undefined, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }

    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (user) {
        await this.auditService.record({
          organizationId: user.organizationId,
          userId: user.id,
          action: 'AUTH_LOGOUT',
          entity: 'User',
          entityId: user.id,
        });
      }
    }
  }

  async getSession(userId: string, organizationId: string): Promise<SessionDto> {
    // O filtro por organizationId e redundante com o id, mas mantem o padrao
    // "toda consulta e tenant-scoped" valido em 100% do codebase.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { organization: true },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Sessao invalida');
    }

    return {
      user: toAuthUserDto(user),
      organization: toOrganizationDto(user.organization),
    };
  }

  static hashPassword(password: string): Promise<string> {
    return hash(password, PASSWORD_SALT_ROUNDS);
  }
}
