/**
 * Quick Action Menu - WhatsApp Inquiry & Quick Buy CTAs
 * Multi-channel engagement for B2B customers
 * Location: apps/web/src/components/catalog/quick-action-menu.tsx
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import type { B2BProduct } from '@/lib/api/b2b-catalog-types';

interface QuickActionMenuProps {
  product: B2BProduct;
  variant?: 'card' | 'detail';
}

export function QuickActionMenu({ product }: QuickActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Construct WhatsApp inquiry message
  const whatsappMessage = encodeURIComponent(
    `Hi Caracal Tech, I am inquiring about:\n\nSKU: ${product.sku}\nProduct: ${product.name}\n\nPlease provide pricing and availability details.`
  );

  // WhatsApp Business API endpoint (replace with actual number)
  const whatsappLink = `https://wa.me/971000000000?text=${whatsappMessage}`;

  // Quick buy would typically add to quote/cart (placeholder)
  const handleQuickBuy = () => {
    // TODO: Implement add-to-quote logic
    console.log('Quick buy:', product.sku);
    setIsOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg bg-slate-800/80 hover:bg-slate-700 p-1.5 transition-colors text-slate-300 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        aria-label="Quick actions"
        aria-expanded={isOpen}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-700/50 bg-slate-900 shadow-xl z-50 overflow-hidden"
          role="menu"
          aria-orientation="vertical"
        >
          {/* WhatsApp Inquiry */}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/80 transition-colors border-b border-slate-800/50"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.364-3.905 6.75-1.907 10.253 1.998 3.503 6.651 4.309 10.255 1.803.791-.57 1.463-1.315 1.973-2.148l-.723-.468c-.5.595-1.046 1.077-1.704 1.526-2.318 1.774-5.702.966-7.066-1.8-1.365-2.766-.487-6.348 1.832-8.123 1.196-.92 2.594-1.412 4.084-1.412h.022c1.378 0 2.686.361 3.83 1.052l.56-.91C15.896 2.748 14.507 2.1 12.837 2.1z"/>
            </svg>
            <div className="flex-1 text-left">
              <div className="font-semibold">WhatsApp</div>
              <div className="text-xs text-slate-400">Quick inquiry</div>
            </div>
            <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>

          {/* Quick Buy / Add to Quote */}
          <button
            onClick={handleQuickBuy}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/80 transition-colors border-b border-slate-800/50 text-left"
            role="menuitem"
          >
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div className="flex-1 text-left">
              <div className="font-semibold">Add to Quote</div>
              <div className="text-xs text-slate-400">Request pricing</div>
            </div>
            <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* View Details */}
          <a
            href={`/shop/${product.slug}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/80 transition-colors"
            role="menuitem"
            onClick={() => setIsOpen(false)}
          >
            <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-left">
              <div className="font-semibold">Full Details</div>
              <div className="text-xs text-slate-400">Specs & images</div>
            </div>
            <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Prominent CTA section for detail page footer
 */
export function DetailPageCTASection({ product }: { product: B2BProduct }) {
  const whatsappMessage = encodeURIComponent(
    `Hi Caracal Tech, I am interested in bulk ordering:\n\nSKU: ${product.sku}\nProduct: ${product.name}\nQuantity: [Please specify]\n\nPlease provide volume pricing and lead time.`
  );
  const whatsappLink = `https://wa.me/971000000000?text=${whatsappMessage}`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* WhatsApp CTA - Primary */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-4 py-3 font-semibold text-white transition-colors"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.364-3.905 6.75-1.907 10.253 1.998 3.503 6.651 4.309 10.255 1.803.791-.57 1.463-1.315 1.973-2.148l-.723-.468c-.5.595-1.046 1.077-1.704 1.526-2.318 1.774-5.702.966-7.066-1.8-1.365-2.766-.487-6.348 1.832-8.123 1.196-.92 2.594-1.412 4.084-1.412h.022c1.378 0 2.686.361 3.83 1.052l.56-.91C15.896 2.748 14.507 2.1 12.837 2.1z"/>
        </svg>
        Inquire via WhatsApp
      </a>

      {/* Add to Quote CTA - Secondary */}
      <button
        onClick={() => console.log('Add to quote:', product.sku)}
        className="flex items-center justify-center gap-2 rounded-lg border-2 border-slate-600 hover:border-slate-500 hover:bg-slate-800/50 px-4 py-3 font-semibold text-slate-200 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Request Quote
      </button>
    </div>
  );
}
