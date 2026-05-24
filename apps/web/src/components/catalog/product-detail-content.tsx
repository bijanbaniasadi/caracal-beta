'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getProductBySlug } from '@/lib/api/catalog-client';
import { productKeys } from '@/hooks/queries/use-products';

import { ProductImages } from './product-images';
import { PricingPanel } from './pricing-panel';
import { StockIndicator } from './stock-indicator';
import { TradeOnlyBadge } from './inventory-badge';
import { GccBadges } from './gcc-badges';
import { AttributesTable } from './attributes-table';
import { InquiryCta } from './inquiry-cta';
import { StickyCta, WhatsAppCta } from './sticky-cta';
import { RelatedProducts } from './related-products';

// ─── Component ────────────────────────────────────────────────────────────────

interface ProductDetailContentProps {
  slug: string;
  initialData?: Awaited<ReturnType<typeof getProductBySlug>>;
}

export function ProductDetailContent({ slug, initialData }: ProductDetailContentProps) {
  const router = useRouter();
  const inlineCtaRef = useRef<HTMLDivElement>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => getProductBySlug(slug),
    initialData,
    staleTime: 60_000,
  });

  if (isLoading) return <ProductDetailSkeleton />;

  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-brand-muted">Product not found</p>
        <Link href="/shop" className="mt-4 text-sm text-brand-orange hover:underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const isAvailable =
    product.inventory.status === 'IN_STOCK' ||
    product.inventory.status === 'LOW_STOCK';

  return (
    <>
      {/* ── Sticky mobile bottom CTA ─────────────────────────────────────── */}
      <StickyCta product={product} inlineCtaRef={inlineCtaRef} />

      <div className="mx-auto max-w-6xl">
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-brand-muted" aria-label="Breadcrumb">
          <Link href="/shop" className="hover:text-brand-text transition-colors">Shop</Link>
          {product.category && (
            <>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => router.push(`/shop?category=${product.category!.slug}`)}
                className="hover:text-brand-text transition-colors"
              >
                {product.category.name}
              </button>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span className="truncate text-brand-text">{product.name}</span>
        </nav>

        {/* ── Main grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">

          {/* Left — images */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <ProductImages images={product.images} productName={product.name} />
          </div>

          {/* Right — details */}
          <div className="flex flex-col gap-6">

            {/* Category + badges row */}
            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <button
                  type="button"
                  onClick={() => router.push(`/shop?category=${product.category!.slug}`)}
                  className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/70 hover:text-brand-orange transition-colors"
                >
                  {product.category.name}
                </button>
              )}
              {product.flags.tradeOnly && <TradeOnlyBadge />}
              {product.flags.featured && (
                <span className="inline-flex items-center rounded-full border border-brand-orange/30 bg-brand-orange/10 px-2 py-0.5 text-xs font-medium text-brand-orange">
                  ★ Featured
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="font-display text-2xl font-bold text-brand-text leading-snug sm:text-3xl">
              {product.name}
            </h1>

            {/* SKU */}
            {product.sku && (
              <p className="text-xs text-brand-muted">
                SKU:{' '}
                <span className="font-mono font-medium text-brand-text">
                  {product.sku}
                </span>
              </p>
            )}

            {/* Short description */}
            {product.shortDescription && (
              <p className="text-sm leading-relaxed text-brand-muted">
                {product.shortDescription}
              </p>
            )}

            {/* Stock indicator */}
            <StockIndicator inventory={product.inventory} />

            {/* Pricing */}
            <div className="border-t border-white/10 pt-5">
              <PricingPanel product={product} />
            </div>

            {/* CTAs — ref for sticky bar intersection logic */}
            <div ref={inlineCtaRef} className="flex flex-col gap-3">
              {/* WhatsApp — primary */}
              <WhatsAppCta product={product} />

              {/* Inline form — secondary */}
              {isAvailable && (
                <InquiryCta inquiry={product.inquiry} />
              )}

              {/* Out of stock: only WhatsApp */}
              {!isAvailable && (
                <p className="text-center text-xs text-brand-muted">
                  Out of stock? We can source it.{' '}
                  <a
                    href={`https://wa.me/971585796760?text=${encodeURIComponent(`Hi, I'm looking for ${product.name}. Is it available or when will it restock?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-orange hover:underline"
                  >
                    Ask on WhatsApp
                  </a>
                </p>
              )}
            </div>

            {/* GCC market badges */}
            <GccBadges product={product} />

            {/* Supplier */}
            {product.supplier && (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <span className="text-brand-muted">Supplied by </span>
                <span className="font-medium text-brand-text">{product.supplier.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Product description ──────────────────────────────────────────── */}
        {product.description && (
          <section className="mt-14 border-t border-white/10 pt-10">
            <h2 className="font-display text-xl font-bold text-brand-text mb-5">
              Product Details
            </h2>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                {product.description.split('\n').map((para, i) =>
                  para.trim() ? (
                    <p key={i} className="text-sm leading-relaxed text-brand-muted">
                      {para}
                    </p>
                  ) : null,
                )}
              </div>
              {/* Attributes table in the sidebar column */}
              <div>
                <AttributesTable attributes={product.attributes} />
              </div>
            </div>
          </section>
        )}

        {/* Attributes when no description (standalone) */}
        {!product.description && (
          <section className="mt-14 border-t border-white/10 pt-10">
            <AttributesTable attributes={product.attributes} />
          </section>
        )}

        {/* ── Related products ─────────────────────────────────────────────── */}
        <div className="mt-14">
          <RelatedProducts
            categorySlug={product.category?.slug ?? null}
            currentProductId={product.id}
          />
        </div>
      </div>
    </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex gap-2">
        <div className="h-4 w-10 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-4 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-white/5" />
        <div className="flex flex-col gap-4">
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-8 w-4/5 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-full animate-pulse rounded bg-white/10" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="h-2.5 w-28 animate-pulse rounded bg-white/10" />
          <div className="h-10 w-36 animate-pulse rounded bg-white/10 mt-2" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-white/10 mt-2" />
          <div className="h-28 animate-pulse rounded-lg bg-white/10 mt-2" />
        </div>
      </div>
    </div>
  );
}
