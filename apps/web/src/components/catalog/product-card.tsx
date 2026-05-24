import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/api/catalog-types';
import { InventoryBadge, TradeOnlyBadge } from './inventory-badge';
import { PriceDisplay } from './price-display';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.isPrimary) ?? product.images[0];
  const isUnavailable =
    product.inventory.status === 'OUT_OF_STOCK' ||
    product.inventory.status === 'DISCONTINUED';

  return (
    <Link
      href={`/shop/${product.slug}`}
      className={[
        'group flex flex-col overflow-hidden rounded-lg border border-slate-200',
        'bg-white transition-shadow hover:shadow-md',
        isUnavailable ? 'opacity-75' : '',
      ].join(' ')}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-12 w-12 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
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
          {product.flags.tradeOnly && <TradeOnlyBadge />}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.category && (
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {product.category.name}
          </span>
        )}

        <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 leading-snug group-hover:text-slate-700">
          {product.name}
        </h3>

        {product.shortDescription && (
          <p className="line-clamp-2 text-xs text-slate-500 leading-relaxed">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between pt-2">
          <PriceDisplay price={product.price} size="sm" />
          <InventoryBadge status={product.inventory.status} />
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="aspect-square animate-pulse bg-slate-100" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
