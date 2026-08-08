import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/products/product-form';

export const metadata: Metadata = {
  title: 'Novo produto',
};

export default function NewProductPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Produtos
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Novo produto
      </h1>
      <p className="mb-6 mt-1 text-sm text-foreground-muted">
        Preencha nome e preco para salvar. O resto pode ficar para depois.
      </p>

      <ProductForm mode="create" />
    </div>
  );
}
