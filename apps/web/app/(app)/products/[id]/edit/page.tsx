import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ProductDto } from '@hub/shared';
import { ProductForm } from '@/components/products/product-form';
import { ApiError } from '@/lib/api/errors';
import { serverFetch } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'Editar produto',
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: ProductDto;

  try {
    product = await serverFetch<ProductDto>(`/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href={`/products/${product.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {product.name}
      </Link>

      <h1 className="mb-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Editar produto
      </h1>

      <ProductForm mode="edit" product={product} />
    </div>
  );
}
