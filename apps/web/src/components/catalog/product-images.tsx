'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProductImage } from '@/lib/api/catalog-types';
import { ImageLightbox } from './image-lightbox';

interface ProductImagesProps {
  images: ProductImage[];
  productName: string;
}

export function ProductImages({ images, productName }: ProductImagesProps) {
  const sorted = [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const active = sorted[activeIndex];

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-white/10 bg-brand-deep">
        <svg
          className="h-20 w-20 text-white/20"
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
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Main image — click to zoom */}
        <button
          type="button"
          aria-label="Click to zoom image"
          onClick={() => setLightboxOpen(true)}
          className="group relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl border border-white/10 bg-brand-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
        >
          {active && (
            <Image
              src={active.url}
              alt={active.altText ?? productName}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
              priority
            />
          )}

          {/* Zoom hint overlay */}
          <span
            aria-hidden="true"
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            Zoom
          </span>

          {/* Image count badge */}
          {sorted.length > 1 && (
            <span
              aria-hidden="true"
              className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
            >
              {activeIndex + 1} / {sorted.length}
            </span>
          )}
        </button>

        {/* Thumbnails */}
        {sorted.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={[
                  'relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                  i === activeIndex
                    ? 'border-brand-orange'
                    : 'border-white/10 hover:border-white/30',
                ].join(' ')}
                aria-label={`View image ${i + 1}`}
                aria-pressed={i === activeIndex}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? `${productName} image ${i + 1}`}
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox portal */}
      {lightboxOpen && (
        <ImageLightbox
          images={sorted}
          activeIndex={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setActiveIndex}
        />
      )}
    </>
  );
}
