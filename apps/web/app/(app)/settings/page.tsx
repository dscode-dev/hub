import type { Metadata } from 'next';
import { Settings } from 'lucide-react';
import { ComingSoon } from '@/components/common/coming-soon';

export const metadata: Metadata = {
  title: 'Configuracoes',
};

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Configuracoes"
      description="Dados da empresa, usuarios e permissoes."
      icon={Settings}
      bullets={[
        'Dados cadastrais da organizacao',
        'Usuarios e papeis de acesso',
        'Formas de pagamento e preferencias',
      ]}
    />
  );
}
