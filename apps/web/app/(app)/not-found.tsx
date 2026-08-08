import Link from 'next/link';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function AppNotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Nao encontramos esta pagina"
      description="O endereco pode estar errado ou o registro foi removido."
      action={
        <Button asChild>
          <Link href="/dashboard">Voltar para a visao geral</Link>
        </Button>
      }
    />
  );
}
