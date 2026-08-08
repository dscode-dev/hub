import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedUser, RequestWithUser } from '../types/authenticated-user';

/**
 * Injeta o usuario autenticado no controller.
 * Lanca se ausente, para que nenhum handler protegido consiga rodar sem tenant.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new UnauthorizedException('Sessao nao autenticada');
    }

    return request.user;
  },
);
