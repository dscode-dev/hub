import type { Metadata } from 'next';
import { Truck } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Entregas',
};

export default function DeliveriesPage() {
  return (
    <ComingSoon
      title="Entregas"
      description="Organizacao das entregas e prazos."
      icon={Truck}
      bullets={[
        'Agenda de entregas por data',
        'Status e comprovacao de entrega',
        'Roteirizacao simples',
      ]}
    />
  );
}
