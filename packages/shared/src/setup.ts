import type { OperationGoal } from './operation-goals';

/**
 * Primeiro acesso da instalacao.
 *
 * A Plataforma Hub roda uma instancia por empresa. Na primeira execucao nao
 * existe usuario nem organizacao: este fluxo cria os dois de uma vez.
 *
 * O backend so aceita o cadastro enquanto nao houver nenhum usuario OWNER -
 * depois disso a rota fica permanentemente fechada.
 */

/** Segmento de atuacao. Metadado de personalizacao, nunca regra de negocio. */
export const BUSINESS_SEGMENTS = [
  'RETAIL',
  'FURNITURE',
  'ELECTRONICS',
  'CONSTRUCTION',
  'DISTRIBUTION',
  'FASHION',
  'FOOD',
  'AUTOMOTIVE',
  'SERVICES',
  'OTHER',
] as const;

export type BusinessSegment = (typeof BUSINESS_SEGMENTS)[number];

export const BUSINESS_SEGMENT_LABELS: Record<BusinessSegment, string> = {
  RETAIL: 'Comercio varejista',
  FURNITURE: 'Moveis e decoracao',
  ELECTRONICS: 'Eletronicos',
  CONSTRUCTION: 'Material de construcao',
  DISTRIBUTION: 'Distribuidora / atacado',
  FASHION: 'Moda e vestuario',
  FOOD: 'Alimentos e bebidas',
  AUTOMOTIVE: 'Automotivo',
  SERVICES: 'Servicos',
  OTHER: 'Outro',
};

export function isBusinessSegment(value: string): value is BusinessSegment {
  return (BUSINESS_SEGMENTS as readonly string[]).includes(value);
}

/** Resposta de `GET /setup/status`. Publica e sem dados sensiveis. */
export interface SetupStatusDto {
  /** true enquanto nao existir nenhum usuario OWNER nesta instalacao. */
  required: boolean;
  completedAt: string | null;
}

export interface SetupAddressPayload {
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  /** UF com duas letras. */
  state?: string | null;
  /** Ponto de referencia: so o cliente sabe informar, nunca vem do CEP. */
  reference?: string | null;
}

export interface SetupOwnerPayload {
  name: string;
  email: string;
  password: string;
}

export interface SetupCompanyPayload {
  name: string;
  tradeName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Logo em data URL (PNG/JPEG/WEBP/SVG). Guardada no proprio banco local. */
  logo?: string | null;
  segments?: BusinessSegment[];
  operationGoals?: OperationGoal[];
  address?: SetupAddressPayload;
}

export interface SetupPayload {
  owner: SetupOwnerPayload;
  company: SetupCompanyPayload;
}

export interface SetupResultDto {
  organizationId: string;
  userId: string;
  completedAt: string;
}

/**
 * Consulta de CEP.
 *
 * Feita pelo backend, e nao pelo renderer: a CSP do app so libera `connect-src`
 * para o proprio backend, e concentrar a chamada la evita CORS e mantem a
 * politica fechada. Sem internet, a resposta e `offline` e o formulario segue
 * preenchivel a mao.
 */
export interface CepLookupDto {
  zipCode: string;
  street: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

/** Limite da logo embutida, para nao inchar o banco local. */
export const MAX_LOGO_BYTES = 512 * 1024;
export const ACCEPTED_LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
