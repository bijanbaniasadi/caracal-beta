import Link from 'next/link';
import type { Product } from '@/lib/api/catalog-types';

interface PricingPanelProps {
  product: Product;
}

export function PricingPanel({ product }: PricingPanelProps) {
  const { price, flags } = product;
  const hasRetail = price.formatted !== null;
  const hasTrade = price.tradeFormatted !== null;
  const isTradeOnly = flags.tradeOnly;

  if (isTradeOnly) {
    return (
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-5">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden="true">🏭</span>
          <div>
            <p className="font-display text-base font-bold text-brand-text">
              Trade Account Required
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              This product is reserved for registered workshops and trade accounts.
              {hasTrade && (
                <> Trade price: <span className="font-semibold text-violet-300">{price.tradeFormatted}</span>.</>
              )}
            </p>
            <Link
              href="/contact?tab=workshop"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"
            >
              Apply for a trade account →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Retail price */}
      {hasRetail ? (
        <div>
          <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-muted">
            Price (incl. VAT)
          </p>
          <p className="font-display text-3xl font-bold text-brand-orange mt-1">
            {price.formatted}
          </p>
        </div>
      ) : (
        <div>
          <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-muted">
            Price
          </p>
          <p className="font-display text-xl font-semibold text-brand-muted mt-1">
            Contact for pricing
          </p>
          <p className="text-xs text-brand-muted mt-0.5">
            Price varies by configuration or region. Enquire via WhatsApp for a fast quote.
          </p>
        </div>
      )}

      {/* Trade price callout */}
      {hasTrade && flags.b2bEligible && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-muted">
              Trade / Workshop price
            </span>
            <span className="font-display text-base font-bold text-violet-300">
              {price.tradeFormatted}
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            Available to registered trade accounts.{' '}
            <Link href="/contact?tab=workshop" className="text-violet-300 hover:underline">
              Apply here
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
