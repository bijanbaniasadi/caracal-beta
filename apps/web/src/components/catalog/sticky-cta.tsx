'use client';

import { useEffect, useRef, useState } from 'react';

import type { Product } from '@/lib/api/catalog-types';

interface StickyCtaProps {
  product: Product;
  /** Ref to the inline CTA panel — bar hides while that panel is on-screen */
  inlineCtaRef?: React.RefObject<HTMLDivElement | null>;
}

export function StickyCta({ product, inlineCtaRef }: StickyCtaProps) {
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Show bar once user scrolls 300px; hide again if inline CTA panel is visible
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY > 300;
      if (!scrolled) { setVisible(false); return; }

      if (inlineCtaRef?.current) {
        const rect = inlineCtaRef.current.getBoundingClientRect();
        const inlineVisible = rect.top < window.innerHeight && rect.bottom > 0;
        setVisible(!inlineVisible);
      } else {
        setVisible(true);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [inlineCtaRef]);

  const waText = encodeURIComponent(
    `Hi, I'm interested in: ${product.name}${product.sku ? ` (SKU: ${product.sku})` : ''}. Can you send pricing and availability?`,
  );
  const waUrl = `https://wa.me/971585796760?text=${waText}`;

  const available =
    product.inventory.status === 'IN_STOCK' ||
    product.inventory.status === 'LOW_STOCK';

  return (
    <>
      {/* Mobile sticky bar */}
      <div
        ref={barRef}
        aria-hidden={!visible}
        className={[
          'fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-brand-deep/95 px-4 py-3 backdrop-blur-md',
          'md:hidden', // desktop uses the detail panel naturally
          'transition-transform duration-300',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        <div className="flex items-center gap-3">
          {/* Price */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-brand-muted">{product.name}</p>
            <p className="font-display text-base font-bold text-brand-orange">
              {product.price.formatted ?? 'Contact for price'}
            </p>
          </div>

          {/* WhatsApp */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow"
          >
            <WhatsAppIcon />
            {available ? 'Order Now' : 'Enquire'}
          </a>
        </div>
      </div>

      {/* Desktop: nothing extra — the sticky panel is handled by the layout */}
    </>
  );
}

// ─── WhatsApp enquiry button (standalone, used inline too) ────────────────────

interface WhatsAppCtaProps {
  product: Product;
  size?: 'sm' | 'md';
  label?: string;
}

export function WhatsAppCta({ product, size = 'md', label }: WhatsAppCtaProps) {
  const waText = encodeURIComponent(
    `Hi, I'm interested in: ${product.name}${product.sku ? ` (SKU: ${product.sku})` : ''}. Can you send pricing and availability?`,
  );
  const waUrl = `https://wa.me/971585796760?text=${waText}`;

  const available =
    product.inventory.status === 'IN_STOCK' ||
    product.inventory.status === 'LOW_STOCK';

  const base = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] font-semibold text-white transition-opacity hover:opacity-90';
  const sz = size === 'sm' ? 'px-3 py-2 text-xs' : 'w-full px-4 py-3 text-sm';

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${sz}`}
    >
      <WhatsAppIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
      {label ?? (available ? 'Order on WhatsApp' : 'Enquire on WhatsApp')}
    </a>
  );
}

function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
