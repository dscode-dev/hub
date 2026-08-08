import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AccessTokenPayload } from '@/common/types/authenticated-user';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Emissao e rotacao de tokens.
 *
 * Access token: JWT curto, carrega o tenant (claim `org`).
 * Refresh token: valor opaco aleatorio; o banco guarda apenas o SHA-256.
 * Assim, vazamento do banco nao permite reutilizar sessoes.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueForUser(user: Pick<User, 'id' | 'email' | 'role' | 'organizationId'>) {
    const expiresIn = this.configService.get<number>('auth.accessExpiresIn') ?? 900;

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      org: user.organizationId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.accessSecret'),
      expiresIn,
    });

    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken, expiresIn } satisfies IssuedTokens;
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(48).toString('hex');
    const ttl = this.configService.get<number>('auth.refreshExpiresIn') ?? 2592000;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    return token;
  }

  /** Revoga o token apresentado. Idempotente. */
  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findValidRefreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      return null;
    }

    return stored;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
