import type { User } from '@prisma/client';
import type { AuthUserDto } from '@hub/shared';

/** Nunca expor passwordHash: o DTO e montado campo a campo de proposito. */
export function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    organizationId: user.organizationId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
