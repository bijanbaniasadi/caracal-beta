/**
 * B2B Product Card - High-Density Technical Scanning
 * Optimized for quick technical reference and bulk ordering
 * Location: apps/web/src/components/catalog/b2b-product-card.tsx
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import type { B2BProduct } from '@/lib/api/b2b-catalog-types';
import { B2BPriceDisplay } from './b2b-price-display';
import { QuickActionMenu } from './quick-action-menu';
import { InventoryBadge } from './status-badge';

interface B2BProductCardProps {
  product: B2BProduct;
  isCompact?: boolean; // Ultra-dense grid mode
}

export function B2BProductCard({ product, isCompact = false }: B2BProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const isUnavailable =
    product.inventory.status === 'OUT_OF_STOCK' ||
    product.inventory.status === 'DISCONTINUED';

  const cardClasses = isCompact
    ? // Ultra-compact: 5-6 columns, minimal padding
      'group flex flex-col overflow-hidden rounded-lg border border-slate-200/30 bg-white/[0.02] hover:bg-white/5 transition-all hover:border-slate-300/50'
    : // Standard density: 2-4 columns, comfortable padding
      'group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors hover:border-brand-orange/30';

  return (
    <div className={`${cardClasses} ${isUnavailable ? 'opacity-60' : ''}`}>
      {/* ─── Product Image Section ─────────────────────────────────────────── */}
      <Link href={`/shop/${product.slug}`} className="relative aspect-square overflow-hidden bg-slate-900">
        {primaryImage && !imageError ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText ?? product.name}
            fill
            sizes={isCompact ? '(max-width: 768px) 50vw, 20vw' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'}
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-110"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-800">
            <svg
              className="h-8 w-8 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.isTradeOnly && (
            <span className="inline-flex items-center rounded-md bg-amber-900/80 px-2 py-1 text-xs font-semibold text-amber-100">
              Trade Only
            </span>
          )}
          {product.discountPercent && product.discountPercent > 0 && (
            <span className="inline-flex items-center rounded-md bg-red-900/80 px-2 py-1 text-xs font-bold text-red-100">
              -{product.discountPercent}%
            </span>
          )}
        </div>

        {/* Quick Action Menu - Fixed to top-right */}
        <div className="absolute right-2 top-2">
          <QuickActionMenu product={product} />
        </div>
      </Link>

      {/* ─── Product Info Section ─────────────────────────────────────────── */}
      <div className={`flex flex-1 flex-col gap-2 ${isCompact ? 'p-2' : 'p-3'}`}>
        {/* SKU - Prominent monospace, always visible first */}
        <div className="font-mono text-xs font-semibold uppercase tracking-widest text-slate-500">
          {product.sku}
        </div>

        {/* Category badge */}
        {product.category && (
          <span className="font-technical text-[10px] font-medium uppercase tracking-wider text-orange-600/70">
            {product.category.name}
          </span>
        )}

        {/* Product name - constrained height */}
        <Link href={`/shop/${product.slug}`} className="group/link">
          <h3
            className={`line-clamp-2 font-semibold text-slate-100 leading-snug group-hover/link:text-brand-orange transition-colors ${
              isCompact ? 'text-xs' : 'text-sm'
            }`}
          >
            {product.name}
          </h3>
        </Link>

        {/* Short description - optional, 2-line max */}
        {product.shortDescription && !isCompact && (
          <p className="line-clamp-2 text-xs text-slate-400 leading-relaxed">
            {product.shortDescription}
          </p>
        )}

        {/* Technical specs mini-summary (if in compact mode) */}
        {isCompact && product.technicalSpecs && product.technicalSpecs.length > 0 && (
          <div className="text-[9px] text-slate-500 space-y-0.5 mt-1">
            {product.technicalSpecs.slice(0, 2).map((spec, i) => (
              <div key={i} className="truncate">
                <span className="font-semibold">{spec.label}:</span> {spec.value}
              </div>
            ))}
          </div>
        )}

        {/* Spacer for flex growth */}
        <div className="mt-auto" />

        {/* Price & Inventory - Bottom section */}
        <div className={`flex items-end justify-between gap-2 pt-2 border-t border-slate-700/50 ${isCompact ? 'flex-col items-start' : ''}`}>
          <B2BPriceDisplay
            price={product.price}
            originalPrice={product.originalPrice}
            discountPercent={product.discountPercent}
            isCompact={isCompact}
          />
          <InventoryBadge status={product.inventory.status} isCompact={isCompact} />
        </div>

        {/* Stock quantity indicator for low stock */}
        {product.inventory.status === 'LOW_STOCK' && product.inventory.quantityAvailable > 0 && (
          <div className="text-xs text-amber-600 font-medium">
            Only {product.inventory.quantityAvailable} left
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function B2BProductCardSkeleton({ isCompact = false }: { isCompact?: boolean }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-lg border border-slate-200/20 bg-slate-900/50 ${isCompact ? 'p-1' : 'p-3'}`}>
      {/* Image skeleton */}
      <div className="aspect-square animate-pulse rounded bg-slate-800" />

      {/* Content skeleton */}
      <div className={`flex flex-col gap-2 mt-2 ${isCompact ? 'space-y-1' : ''}`}>
        {/* SKU */}
        <div className={`h-2 w-16 animate-pulse rounded bg-slate-700 ${isCompact ? 'h-1.5' : ''}`} />
        {/* Category */}
        <div className={`h-2 w-12 animate-pulse rounded bg-slate-700 ${isCompact ? 'h-1' : ''}`} />
        {/* Title */}
        <div className={`h-3 w-full animate-pulse rounded bg-slate-700 ${isCompact ? 'h-2' : ''}`} />
        {!isCompact && <div className="h-2 w-3/4 animate-pulse rounded bg-slate-700" />}

        {/* Price & inventory */}
        <div className="mt-auto pt-2 flex justify-between">
          <div className={`h-3 w-16 animate-pulse rounded bg-slate-700 ${isCompact ? 'h-2' : ''}`} />
          <div className={`h-4 w-12 animate-pulse rounded-full bg-slate-700 ${isCompact ? 'h-3' : ''}`} />
        </div>
      </div>
    </div>
  );
}
