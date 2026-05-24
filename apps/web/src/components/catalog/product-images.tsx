'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProductImage } from '@/lib/api/catalog-types';

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
  const active = sorted[activeIndex];

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100">
        <svg
          className="h-20 w-20 text-slate-300"
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
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-50">
        {active && (
          <Image
            src={active.url}
            alt={active.altText ?? productName}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain p-6"
            priority
          />
        )}
      </div>

      {/* Thumbnails (only when > 1 image) */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={[
                'relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                i === activeIndex
                  ? 'border-slate-900'
                  : 'border-slate-200 hover:border-slate-400',
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
  );
}
