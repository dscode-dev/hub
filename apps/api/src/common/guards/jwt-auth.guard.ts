import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { isUserRole } from '@hub/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenPayload, RequestWithUser } from '../types/authenticated-user';

/**
 * Guard global. Valida o access token e monta o contexto de tenant.
 * Aplicado a TODAS as rotas; excecoes precisam ser marcadas com @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get<string>('auth.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Token de acesso invalido ou expirado');
    }

    if (!payload.sub || !payload.org || !isUserRole(payload.role)) {
      throw new UnauthorizedException('Token de acesso malformado');
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organizationId: payload.org,
    };

    return true;
  }

  private extractToken(request: RequestWithUser): string | null {
    const header = request.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;

    if (!value) {
      return null;
    }

    const [scheme, token] = value.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
