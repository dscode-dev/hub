import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ImportWizard } from './import-wizard';

export const metadata: Metadata = {
  title: 'Importar produtos',
};

export default function ImportProductsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Produtos
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Importar produtos
      </h1>
      <p className="mb-6 mt-1 text-sm text-foreground-muted">
        Envie sua planilha em CSV. Nao precisa renomear nada: voce indica qual coluna e qual
        na proxima etapa.
      </p>

      <ImportWizard />
    </div>
  );
}
