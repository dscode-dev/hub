import type { Metadata } from 'next';
import { Receipt } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Financeiro',
};

export default function FinancePage() {
  return (
    <ComingSoon
      title="Financeiro"
      description="Entradas, saidas e resultado do periodo."
      icon={Receipt}
      bullets={[
        'Contas a receber e a pagar',
        'Conciliacao de recebimentos',
        'Fluxo de caixa por periodo',
      ]}
    />
  );
}
