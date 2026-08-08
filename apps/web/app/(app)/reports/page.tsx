import type { Metadata } from 'next';
import { BarChart3 } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Relatorios',
};

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Relatorios"
      description="Numeros da operacao para tomar decisao."
      icon={BarChart3}
      bullets={[
        'Vendas por periodo, produto e vendedor',
        'Margem e curva ABC de produtos',
        'Exportacao em CSV',
      ]}
    />
  );
}
