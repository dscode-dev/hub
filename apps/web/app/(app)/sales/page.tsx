import type { Metadata } from 'next';
import { ShoppingCart } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Vendas',
};

export default function SalesPage() {
  return (
    <ComingSoon
      title="Vendas"
      description="Registro de vendas e acompanhamento do que sai."
      icon={ShoppingCart}
      bullets={[
        'Venda em poucos cliques com busca de produto',
        'Formas de pagamento e parcelamento',
        'Vinculo automatico com estoque e financeiro',
      ]}
    />
  );
}
