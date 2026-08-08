/**
 * Acoes registradas na auditoria. Comeca pequeno e cresce por dominio.
 * Formato: <ENTIDADE>_<ACAO> em ingles, para facilitar filtros e indices.
 */
export const AUDIT_ACTIONS = [
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DEACTIVATED',
  'PRODUCT_IMPORTED',
  'ORGANIZATION_UPDATED',
  'ONBOARDING_COMPLETED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = ['User', 'Product', 'Organization', 'ImportJob'] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];
