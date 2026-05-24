import type { ProductPrice } from '@/lib/api/catalog-types';

interface PriceDisplayProps {
  price: ProductPrice;
  /** Show trade price alongside retail when available. Default: false. */
  showTrade?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl font-semibold',
};

export function PriceDisplay({
  price,
  showTrade = false,
  size = 'md',
}: PriceDisplayProps) {
  if (!price.formatted) {
    return (
      <span className={`font-medium text-brand-muted ${SIZE[size]}`}>
        Contact for price
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className={`font-semibold text-brand-orange ${SIZE[size]}`}>
        {price.formatted}
      </span>
      {showTrade && price.tradeFormatted && (
        <span className="text-xs text-violet-400">
          Trade: {price.tradeFormatted}
        </span>
      )}
    </div>
  );
}
