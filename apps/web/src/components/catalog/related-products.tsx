'use client';

import { useMemo } from 'react';
import { useProducts } from '@/hooks/queries/use-products';
import { ProductCard, ProductCardSkeleton } from './product-card';

interface RelatedProductsProps {
  categorySlug: string | null;
  currentProductId: string;
}

export function RelatedProducts({ categorySlug, currentProductId }: RelatedProductsProps) {
  const { data, isLoading } = useProducts(
    categorySlug ? { categorySlug, sort: 'featured', limit: 8 } : {},
  );

  const related = useMemo(
    () =>
      (data?.pages.flatMap((p) => p.items) ?? [])
        .filter((p) => p.id !== currentProductId)
        .slice(0, 4),
    [data, currentProductId],
  );

  // Don't render section at all if there's nothing to show
  if (!isLoading && related.length === 0) return null;

  return (
    <section className="border-t border-white/10 pt-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-brand-text">
          Related Products
        </h2>
        {categorySlug && (
          <a
            href={`/shop?category=${categorySlug}`}
            className="text-sm font-medium text-brand-orange hover:underline"
          >
            View all →
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : related.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
      </div>
    </section>
  );
}
