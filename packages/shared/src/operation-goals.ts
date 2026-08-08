/**
 * Objetivos de operacao coletados no onboarding.
 * Usados futuramente para personalizar navegacao, checklist e modulos sugeridos.
 */
export const OPERATION_GOALS = [
  'SELL_PRODUCTS',
  'MANAGE_INVENTORY',
  'MANAGE_FINANCE',
  'INSTALLMENT_PAYMENTS',
  'MANAGE_DELIVERIES',
] as const;

export type OperationGoal = (typeof OPERATION_GOALS)[number];

export const OPERATION_GOAL_LABELS: Record<OperationGoal, string> = {
  SELL_PRODUCTS: 'Vender produtos',
  MANAGE_INVENTORY: 'Controlar estoque',
  MANAGE_FINANCE: 'Controlar financeiro',
  INSTALLMENT_PAYMENTS: 'Receber pagamentos parcelados',
  MANAGE_DELIVERIES: 'Organizar entregas',
};

export const OPERATION_GOAL_DESCRIPTIONS: Record<OperationGoal, string> = {
  SELL_PRODUCTS: 'Registrar vendas e acompanhar o que sai da loja.',
  MANAGE_INVENTORY: 'Saber quanto tem de cada produto e evitar faltas.',
  MANAGE_FINANCE: 'Acompanhar entradas, saidas e resultado do mes.',
  INSTALLMENT_PAYMENTS: 'Vender parcelado e controlar o que tem a receber.',
  MANAGE_DELIVERIES: 'Organizar rotas, prazos e entregas realizadas.',
};

export function isOperationGoal(value: string): value is OperationGoal {
  return (OPERATION_GOALS as readonly string[]).includes(value);
}
