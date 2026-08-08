import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@hub/shared';

export const ROLES_KEY = 'requiredRoles';

/**
 * Base minima de RBAC: declara quais papeis podem acessar a rota.
 * A politica fina (por recurso/campo) fica para quando os dominios existirem.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
