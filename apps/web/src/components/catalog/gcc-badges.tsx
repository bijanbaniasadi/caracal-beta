import type { Product } from '@/lib/api/catalog-types';

interface GccBadgesProps {
  product: Product;
}

/**
 * Derives GCC-market context badges from product data.
 * Shows heat suitability, market availability, and regional notes.
 */
export function GccBadges({ product }: GccBadgesProps) {
  const badges = deriveGccBadges(product);
  if (badges.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <p className="mb-3 font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/70">
        GCC Market Info
      </p>
      <div className="flex flex-col gap-2">
        {badges.map((badge) => (
          <div key={badge.label} className="flex items-start gap-3">
            <span className={`mt-0.5 flex-shrink-0 text-base leading-none ${badge.iconColor}`} aria-hidden="true">
              {badge.icon}
            </span>
            <div>
              <span className="text-xs font-semibold text-brand-text">{badge.label}</span>
              {badge.note && (
                <p className="mt-0.5 text-xs text-brand-muted">{badge.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GccBadge {
  icon: string;
  iconColor: string;
  label: string;
  note?: string;
}

function deriveGccBadges(product: Product): GccBadge[] {
  const badges: GccBadge[] = [];
  const categoryName = product.category?.name?.toLowerCase() ?? '';
  const productName = product.name.toLowerCase();
  const supplierName = product.supplier?.name?.toLowerCase() ?? '';

  // UAE / GCC distribution
  badges.push({
    icon: '🇦🇪',
    iconColor: 'text-base',
    label: 'UAE Authorised Stock',
    note: 'Stocked and dispatched from Dubai, Deira.',
  });

  // Professional ECU tools — heat-rated
  const isEcuTool = (
    categoryName.includes('ecu') ||
    categoryName.includes('tuning') ||
    categoryName.includes('diagnostic') ||
    productName.includes('kess') ||
    productName.includes('autotuner') ||
    productName.includes('bflash') ||
    productName.includes('ktag') ||
    productName.includes('flex')
  );

  if (isEcuTool) {
    badges.push({
      icon: '🌡️',
      iconColor: 'text-amber-400',
      label: 'GCC Heat Rated — 50 °C+ ambient',
      note: 'Tested in high-temperature workshop environments. Internal thermal protection active.',
    });
    badges.push({
      icon: '⚡',
      iconColor: 'text-brand-orange',
      label: '220V / GCC power compatible',
      note: 'Works with standard UAE / GCC wall supply. No voltage converter required.',
    });
  }

  // Alientech / authorised ecosystem
  if (
    supplierName.includes('alientech') ||
    productName.includes('kess3') ||
    productName.includes('k-tag') ||
    productName.includes('ktag')
  ) {
    badges.push({
      icon: '✅',
      iconColor: 'text-brand-green',
      label: 'Alientech Authorised Reseller',
      note: 'Genuine hardware — not a clone. Includes valid serial, online credits, and OTA updates.',
    });
  }

  // AutoTuner ecosystem
  if (productName.includes('autotuner') || supplierName.includes('autotuner')) {
    badges.push({
      icon: '✅',
      iconColor: 'text-brand-green',
      label: 'AutoTuner Authorised',
      note: 'Registered GCC distributor. Full protocol access and master licence support.',
    });
  }

  // Trade-only
  if (product.flags.tradeOnly) {
    badges.push({
      icon: '🏭',
      iconColor: 'text-violet-400',
      label: 'Workshop & Trade Accounts Only',
      note: 'This item is reserved for registered workshops. Submit a consultation request to apply.',
    });
  }

  // B2B eligible
  if (product.flags.b2bEligible && !product.flags.tradeOnly) {
    badges.push({
      icon: '💼',
      iconColor: 'text-sky-400',
      label: 'B2B / Volume Pricing Available',
      note: 'Contact us via WhatsApp for fleet or multi-unit discounts.',
    });
  }

  return badges;
}
