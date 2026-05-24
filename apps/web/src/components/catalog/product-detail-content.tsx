'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getProductBySlug } from '@/lib/api/catalog-client';
import { productKeys } from '@/hooks/queries/use-products';
import { ProductImages } from './product-images';
import { PriceDisplay } from './price-display';
import { InventoryBadge, TradeOnlyBadge } from './inventory-badge';
import { InquiryCta } from './inquiry-cta';

// ─── Component ────────────────────────────────────────────────────────────────

interface ProductDetailContentProps {
  slug: string;
  /** Pre-loaded from server for instant paint; stale after 60 s. */
  initialData?: Awaited<ReturnType<typeof getProductBySlug>>;
}

export function ProductDetailContent({
  slug,
  initialData,
}: ProductDetailContentProps) {
  const { data: product, isLoading, isError } = useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => getProductBySlug(slug),
    initialData,
    staleTime: 60_000,
  });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-slate-600">Product not found</p>
        <Link
          href="/shop"
          className="mt-4 text-sm text-slate-500 underline hover:text-slate-900"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-400">
        <Link href="/shop" className="hover:text-slate-600">
          Shop
        </Link>
        {product.category && (
          <>
            <span>/</span>
            <button
              type="button"
              onClick={() => {
                window.location.href = `/shop?category=${product.category!.slug}`;
              }}
              className="hover:text-slate-600"
            >
              {product.category.name}
            </button>
          </>
        )}
        <span>/</span>
        <span className="truncate text-slate-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* ── Left: images ─────────────────────────────────────────────── */}
        <div>
          <ProductImages images={product.images} productName={product.name} />
        </div>

        {/* ── Right: details ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Category / badges */}
          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {product.category.name}
              </span>
            )}
            <InventoryBadge status={product.inventory.status} />
            {product.flags.tradeOnly && <TradeOnlyBadge />}
          </div>

          {/* Name */}
          <h1 className="text-2xl font-bold text-slate-900 leading-snug">
            {product.name}
          </h1>

          {/* SKU */}
          {product.sku && (
            <p className="text-xs text-slate-400">
              SKU:{' '}
              <span className="font-mono font-medium text-slate-600">
                {product.sku}
              </span>
            </p>
          )}

          {/* Short description */}
          {product.shortDescription && (
            <p className="text-sm leading-relaxed text-slate-600">
              {product.shortDescription}
            </p>
          )}

          {/* Price */}
          <div className="border-t border-slate-100 pt-4">
            <PriceDisplay price={product.price} showTrade size="lg" />
          </div>

          {/* Inventory availability note */}
          {product.inventory.status === 'LOW_STOCK' &&
            product.inventory.quantityAvailable > 0 && (
              <p className="text-xs text-amber-600">
                Only {product.inventory.quantityAvailable} left in stock
              </p>
            )}

          {/* Inquiry CTA */}
          <InquiryCta inquiry={product.inquiry} />
        </div>
      </div>

      {/* ── Full description ──────────────────────────────────────────────── */}
      {product.description && (
        <div className="mt-12 border-t border-slate-100 pt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Product Details
          </h2>
          {/* description may contain newlines; preserve them */}
          <div className="prose prose-slate max-w-none text-sm">
            {product.description.split('\n').map((para, i) =>
              para.trim() ? (
                <p key={i} className="mb-3 leading-relaxed text-slate-600">
                  {para}
                </p>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* ── Supplier ──────────────────────────────────────────────────────── */}
      {product.supplier && (
        <div className="mt-6 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Supplied by{' '}
          <span className="font-medium text-slate-900">
            {product.supplier.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex gap-2">
        <div className="h-4 w-10 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-4 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-lg bg-slate-100" />

        <div className="flex flex-col gap-4">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-8 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
