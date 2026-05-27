'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCurrencyDisplay } from '@/contexts/currency-display';
import type {
  ProjectionProduct,
  ProjectionSearchProduct,
} from '@/lib/api/projection-catalog-types';
import {
  compareAtLabel,
  discountLabel,
  imageLabel,
  priceLabel,
  productImageUrl,
  specChipLabel,
} from './projection-utils';

export function ProjectionProductCard({
  product,
}: {
  product: ProjectionProduct | ProjectionSearchProduct;
}) {
  const { currency, rates } = useCurrencyDisplay();
  const imageUrl = productImageUrl(product);
  const productHref = `/catalog/product/${product.slug}`;
  const compareAt = compareAtLabel(product, currency, rates);
  const discount = discountLabel(product);
  const vendorName =
    ('vendorOffers' in product ? product.vendorOffers[0]?.vendorName : undefined) ??
    product.sourcingVendorName ??
    undefined;
  const specChips =
    'specs' in product
      ? product.specs
          .map(specChipLabel)
          .filter((label): label is string => Boolean(label))
          .slice(0, 3)
      : [];
  const offerCountLabel = `${product.offerCount} supplier ${
    product.offerCount === 1 ? 'offer' : 'offers'
  }`;

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex gap-3">
        <Link
          href={productHref}
          className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-brand-deep"
          aria-label={`View ${product.name}`}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageLabel(product)}
              fill
              sizes="96px"
              className="object-contain p-2"
              unoptimized
            />
          ) : (
            <span className="px-2 text-center text-xs leading-4 text-brand-muted">
              Image coming soon
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="truncate text-xs font-semibold uppercase tracking-wide text-brand-orange">
            <Link href={`/catalog/manufacturer/${product.manufacturer.slug}`}>
              {product.manufacturer.name}
            </Link>
          </div>

          <Link
            href={productHref}
            className="line-clamp-2 text-sm font-semibold leading-5 text-brand-text hover:text-brand-orange"
          >
            {product.name}
          </Link>

          <Link
            href={`/catalog/category/${product.category.slug}`}
            className="block truncate text-xs text-brand-muted hover:text-brand-text"
          >
            {product.category.name}
          </Link>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-base font-bold text-brand-text">
                {priceLabel(product, currency, rates)}
              </span>
              {compareAt ? (
                <span className="text-xs text-brand-muted line-through">{compareAt}</span>
              ) : null}
              {discount ? (
                <span className="rounded-full bg-brand-orange px-2 py-0.5 text-xs font-semibold text-white">
                  {discount}
                </span>
              ) : null}
            </div>
          </div>

          <span
            className={[
              'inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold',
              product.inStock
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-white/5 text-brand-muted',
            ].join(' ')}
          >
            {product.inStock ? 'In stock' : 'Check stock'}
          </span>

          {vendorName ? (
            <p className="truncate text-xs text-brand-muted">
              Source: <span className="text-brand-text">{vendorName}</span>
            </p>
          ) : null}

          {specChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {specChips.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-brand-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-brand-muted">{offerCountLabel}</p>
        </div>
      </div>
    </article>
  );
}
