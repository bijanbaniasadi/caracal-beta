/**
 * B2B Price Display - Professional Pricing & Discount Visuals
 * Handles original price strikethrough and discount percentage badge
 * Location: apps/web/src/components/catalog/b2b-price-display.tsx
 */

'use client';

import { useMemo } from 'react';

interface B2BPriceDisplayProps {
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  size?: 'sm' | 'md' | 'lg';
  isCompact?: boolean;
  showCurrency?: boolean;
}

export function B2BPriceDisplay({
  price,
  originalPrice,
  discountPercent,
  size = 'md',
  isCompact = false,
  showCurrency = true,
}: B2BPriceDisplayProps) {
  // Calculate discount if not provided
  const calculatedDiscount = useMemo(() => {
    if (discountPercent !== undefined) {
      return discountPercent;
    }
    if (originalPrice && originalPrice > price) {
      return Math.round(((originalPrice - price) / originalPrice) * 100);
    }
    return 0;
  }, [price, originalPrice, discountPercent]);

  const hasDiscount = calculatedDiscount > 0 && originalPrice && originalPrice > price;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const currencySymbol = '₪'; // Or use props for locale-based symbol

  return (
    <div className={`flex items-center gap-2 ${isCompact ? 'flex-col items-start gap-1' : ''}`}>
      {/* Original price (strikethrough if discount) */}
      {hasDiscount && (
        <div className="flex items-center gap-1">
          <span className={`line-through text-slate-500 ${sizeClasses[size]}`}>
            {showCurrency ? currencySymbol : ''}
            {(originalPrice / 100).toFixed(2)}
          </span>
          {/* Discount badge */}
          <span className="inline-flex items-center rounded-full bg-red-900/20 px-2 py-0.5 text-xs font-bold text-red-400 border border-red-900/30">
            -{calculatedDiscount}%
          </span>
        </div>
      )}

      {/* Active price (prominent) */}
      <span className={`font-semibold text-slate-100 ${sizeClasses[size]}`}>
        {showCurrency ? currencySymbol : ''}
        {(price / 100).toFixed(2)}
      </span>

      {/* Bulk pricing indicator if available */}
      {!isCompact && (
        <span className="text-[10px] text-slate-500 font-medium italic">
          /unit
        </span>
      )}
    </div>
  );
}

/**
 * Compact inline price component for tables or dense layouts
 */
export function B2BPriceInline({
  price,
  originalPrice,
  discountPercent,
}: Omit<B2BPriceDisplayProps, 'size' | 'showCurrency' | 'isCompact'>) {
  const hasDiscount = discountPercent && discountPercent > 0 && originalPrice && originalPrice > price;

  return (
    <span className="text-xs font-semibold">
      {hasDiscount && <span className="line-through text-slate-500">₪{(originalPrice! / 100).toFixed(2)}</span>}
      <span className={hasDiscount ? 'ml-1 text-red-400' : 'text-slate-100'}>
        ₪{(price / 100).toFixed(2)}
      </span>
    </span>
  );
}

/**
 * Volume pricing tier display (for detail page)
 */
interface VolumeTierProps {
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: number;
  discountPercent?: number;
}

export function VolumePricingTiers({ tiers }: { tiers: VolumeTierProps[] }) {
  if (!tiers || tiers.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3">
      <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
        Volume Pricing
      </h4>
      <div className="space-y-1">
        {tiers.map((tier, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              {tier.minQuantity}
              {tier.maxQuantity ? `–${tier.maxQuantity}` : '+'} units
            </span>
            <div className="flex items-center gap-2">
              {tier.discountPercent && tier.discountPercent > 0 && (
                <span className="text-red-400 font-semibold">-{tier.discountPercent}%</span>
              )}
              <span className="font-semibold text-slate-200">
                ₪{(tier.pricePerUnit / 100).toFixed(2)}/unit
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
