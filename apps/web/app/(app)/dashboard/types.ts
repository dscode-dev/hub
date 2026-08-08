import type { Route } from 'next';

export type SetupStepKey =
  | 'first_product'
  | 'first_customer'
  | 'first_sale'
  | 'payment_methods';

export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
  /** false enquanto o modulo correspondente ainda nao existe. */
  available: boolean;
}

export interface SetupStatus {
  productsCount: number;
  categoriesCount: number;
  steps: SetupStep[];
}

export const SETUP_STEP_LABELS: Record<SetupStepKey, string> = {
  first_product: 'Cadastrar primeiro produto',
  first_customer: 'Adicionar primeiro cliente',
  first_sale: 'Registrar primeira venda',
  payment_methods: 'Configurar formas de pagamento',
};

export const SETUP_STEP_HREF: Record<SetupStepKey, Route | null> = {
  first_product: '/products/new',
  first_customer: null,
  first_sale: null,
  payment_methods: null,
};
