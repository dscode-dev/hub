/**
 * Papeis de usuario da Plataforma Hub.
 *
 * Mantidos como const object (e nao enum TS) para poderem ser consumidos tanto
 * pelo backend quanto pelo frontend sem depender do runtime do Prisma.
 * A base de RBAC fica intencionalmente simples neste primeiro passo: apenas a
 * lista de papeis e um ranking para futuras verificacoes de hierarquia.
 */
export const USER_ROLES = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'SELLER',
  'FINANCE',
  'STOCK',
  'DELIVERY',
  'VIEWER',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Quanto maior o numero, maior o alcance do papel. Base para RBAC futuro. */
export const USER_ROLE_RANK: Record<UserRole, number> = {
  OWNER: 100,
  ADMIN: 90,
  MANAGER: 70,
  FINANCE: 50,
  STOCK: 50,
  SELLER: 40,
  DELIVERY: 30,
  VIEWER: 10,
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Proprietario',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
  FINANCE: 'Financeiro',
  STOCK: 'Estoque',
  DELIVERY: 'Entregas',
  VIEWER: 'Visualizacao',
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
