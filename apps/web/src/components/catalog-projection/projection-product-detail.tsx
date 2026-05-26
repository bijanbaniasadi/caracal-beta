'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ProjectionImage, ProjectionProduct } from '@/lib/api/projection-catalog-types';
import { imageLabel, priceLabel } from './projection-utils';

function imageUrl(image: ProjectionImage | null): string | null {
  return image?.url ?? null;
}

function specLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function compatibilityLabel(item: ProjectionProduct['compatibility'][number]): string {
  const years =
    item.year_from || item.year_to
      ? [item.year_from ?? 'Any', item.year_to ?? 'Current'].join('-')
      : 'Any year';
  return [item.make, item.model, years, item.ecu].filter(Boolean).join(' / ');
}

export function ProjectionProductDetail({ product }: { product: ProjectionProduct }) {
  const images = useMemo(() => {
    const unique = new Map<string, ProjectionImage>();
    for (const image of [product.primaryImage, ...product.galleryImages]) {
      if (!image?.url) continue;
      unique.set(image.url, image);
    }
    return Array.from(unique.values());
  }, [product.galleryImages, product.primaryImage]);
  const [selectedUrlKey, setSelectedUrlKey] = useState(images[0]?.url ?? null);
  const selectedImage = images.find((image) => image.url === selectedUrlKey) ?? images[0] ?? null;
  const selectedUrl = imageUrl(selectedImage);

  return (
    <article className="space-y-10">
      <nav
        className="flex flex-wrap items-center gap-2 text-xs text-brand-muted"
        aria-label="Breadcrumb"
      >
        <Link href="/catalog" className="hover:text-brand-text">
          Catalog
        </Link>
        <span>/</span>
        <Link href={`/catalog/category/${product.category.slug}`} className="hover:text-brand-text">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-brand-text">{product.name}</span>
      </nav>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-[#101a22]">
            {selectedUrl ? (
              <div className="relative h-full w-full">
                <Image
                  src={selectedUrl}
                  alt={selectedImage?.altText ?? imageLabel(product)}
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-contain p-6"
                  priority
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-brand-muted">
                Projection image pending
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {images.map((image) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setSelectedUrlKey(image.url)}
                  className={[
                    'aspect-square overflow-hidden rounded-md border bg-[#101a22]',
                    image.url === selectedImage?.url
                      ? 'border-brand-orange'
                      : 'border-white/10 hover:border-white/30',
                  ].join(' ')}
                  aria-label={`Show image ${image.sortOrder + 1}`}
                >
                  {image.url ? (
                    <span className="relative block h-full w-full">
                      <Image
                        src={image.url}
                        alt={image.altText ?? imageLabel(product)}
                        fill
                        sizes="96px"
                        className="object-contain p-2"
                        unoptimized
                      />
                    </span>
                  ) : (
                    <span className="block h-full w-full bg-white/5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-orange">
              <Link href={`/catalog/manufacturer/${product.manufacturer.slug}`}>
                {product.manufacturer.name}
              </Link>
              <span className="text-brand-muted">/</span>
              <Link href={`/catalog/category/${product.category.slug}`}>
                {product.category.name}
              </Link>
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight text-brand-text">
              {product.name}
            </h1>
            {product.shortDescription && (
              <p className="text-sm leading-6 text-brand-muted">{product.shortDescription}</p>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Curated price
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="font-display text-2xl font-bold text-brand-text">
                {priceLabel(product)}
              </p>
              <span
                className={[
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  product.inStock
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : 'bg-white/5 text-brand-muted',
                ].join(' ')}
              >
                {product.inStock ? 'In stock' : 'Confirm stock'}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brand-text">Vendor offers</p>
              <span className="text-xs text-brand-muted">{product.offerCount} projected</span>
            </div>
            <div className="mt-3 space-y-2">
              {product.vendorOffers.length > 0 ? (
                product.vendorOffers.map((offer) => (
                  <div
                    key={`${offer.vendorName}-${offer.priceCents ?? 'quote'}`}
                    className="grid gap-2 rounded-md border border-white/10 px-3 py-2 text-sm sm:grid-cols-[1fr_auto_auto]"
                  >
                    <span className="font-medium text-brand-text">{offer.vendorName}</span>
                    <span className="text-brand-muted">{offer.formatted ?? 'Request price'}</span>
                    <span className={offer.inStock ? 'text-emerald-300' : 'text-brand-muted'}>
                      {offer.inStock ? 'In stock' : 'Unknown'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-white/10 px-3 py-5 text-sm text-brand-muted">
                  No vendor offer comparison is projected yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {(product.longDescriptionMd ||
        product.specs.length > 0 ||
        product.compatibility.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-brand-text">Product details</h2>
            {product.longDescriptionMd ? (
              <div className="space-y-3 text-sm leading-6 text-brand-muted">
                {product.longDescriptionMd
                  .split('\n')
                  .map((paragraph, index) =>
                    paragraph.trim() ? <p key={index}>{paragraph}</p> : null
                  )}
              </div>
            ) : (
              <p className="text-sm text-brand-muted">Detailed copy has not been curated yet.</p>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-sm font-semibold text-brand-text">Specifications</h2>
              {product.specs.length > 0 ? (
                <dl className="mt-3 divide-y divide-white/10">
                  {product.specs.map((spec, index) => (
                    <div
                      key={`${spec.key ?? 'spec'}-${index}`}
                      className="grid grid-cols-2 gap-3 py-2 text-sm"
                    >
                      <dt className="text-brand-muted">{spec.key ?? 'Spec'}</dt>
                      <dd className="text-right text-brand-text">
                        {[specLabel(spec.value), spec.unit].filter(Boolean).join(' ')}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-brand-muted">Specs are pending curation.</p>
              )}
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-sm font-semibold text-brand-text">Compatibility</h2>
              {product.compatibility.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {product.compatibility.map((item, index) => (
                    <li key={index} className="rounded-md border border-white/10 px-3 py-2 text-sm">
                      <p className="font-medium text-brand-text">{compatibilityLabel(item)}</p>
                      {item.notes && <p className="mt-1 text-xs text-brand-muted">{item.notes}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-brand-muted">Compatibility is pending curation.</p>
              )}
            </section>
          </div>
        </section>
      )}
    </article>
  );
}
