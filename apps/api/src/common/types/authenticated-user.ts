import type { UserRole } from '@hub/shared';

/**
 * Identidade resolvida a partir do access token.
 *
 * `organizationId` vem SEMPRE daqui - nunca do corpo, query ou header da
 * requisicao. Esse e o unico ponto de verdade para escopo de tenant.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  org: string;
  iat?: number;
  exp?: number;
}

/** Request do Express enriquecido pelo JwtAuthGuard. */
export interface RequestWithUser {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
