'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAdminProduct } from '@/hooks/queries/use-admin-products';
import { ProductForm } from '@/components/admin/products/product-form';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: Props) {
  const { id } = use(params);
  const { data: product, isLoading, isError } = useAdminProduct(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <AdminTableSkeleton rows={4} cols={2} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm text-brand-muted">Product not found.</p>
        <Link
          href="/admin/products"
          className="mt-4 inline-block text-sm text-brand-orange hover:underline"
        >
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-lg font-bold text-brand-text">
        Edit: {product.name}
      </h2>
      <ProductForm product={product} />
    </div>
  );
}
