import type { Metadata } from 'next';
import { Boxes } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Estoque',
};

export default function InventoryPage() {
  return (
    <ComingSoon
      title="Estoque"
      description="Saldos, entradas e saidas de cada produto."
      icon={Boxes}
      bullets={[
        'Movimentacoes de entrada e saida com historico',
        'Alertas de estoque minimo',
        'Inventario e ajustes manuais',
      ]}
    />
  );
}
