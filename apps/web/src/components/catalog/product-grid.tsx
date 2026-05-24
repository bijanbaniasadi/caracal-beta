'use client';

import type { Product } from '@/lib/api/catalog-types';
import { ProductCard, ProductCardSkeleton } from './product-card';

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  skeletonCount?: number;
}

export function ProductGrid({
  products,
  isLoading = false,
  skeletonCount = 12,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg
          className="mb-4 h-12 w-12 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm font-medium text-slate-600">No products found</p>
        <p className="mt-1 text-xs text-slate-400">
          Try adjusting your filters or search term.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
