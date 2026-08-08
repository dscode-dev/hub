import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Clientes',
};

export default function CustomersPage() {
  return (
    <ComingSoon
      title="Clientes"
      description="Cadastro unico de quem compra com voce."
      icon={Users}
      bullets={[
        'Cadastro rapido com dados essenciais',
        'Historico de compras por cliente',
        'Limite e condicoes de crediario',
      ]}
    />
  );
}
