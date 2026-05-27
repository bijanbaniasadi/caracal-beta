import type {
  DisplayCurrency,
  ProjectionProduct,
  ProjectionSearchProduct,
  ProjectionPrice,
  ProjectionSpec,
  ProjectionSortOption,
  ProjectionCurrencyRates,
} from '@/lib/api/projection-catalog-types';

export const projectionSortOptions: Array<{ value: ProjectionSortOption; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'price_asc', label: 'Price low' },
  { value: 'price_desc', label: 'Price high' },
];

export function isNewCatalogFrontendEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_NEW_CATALOG_FRONTEND === 'true' ||
    process.env.NEW_CATALOG_FRONTEND === 'true'
  );
}

type ProjectionCardProduct = ProjectionProduct | ProjectionSearchProduct;
type RateMap = ProjectionCurrencyRates['rates'];

const priceLocales: Record<DisplayCurrency, string> = {
  AED: 'en-AE',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

function hasPrice(price: ProjectionPrice | null | undefined): price is ProjectionPrice {
  return Boolean(price && (price.formatted || typeof price.priceCents === 'number'));
}

function hasUsableRate(currency: DisplayCurrency, rates: RateMap): boolean {
  if (currency === 'AED') return true;
  const rate = rates[currency];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

export function displayPrice(
  aedCents: number | null | undefined,
  currency: DisplayCurrency,
  rates: RateMap
): string | null {
  if (typeof aedCents !== 'number' || !Number.isFinite(aedCents)) return null;

  const displayCurrency = hasUsableRate(currency, rates) ? currency : 'AED';
  const rateToAed = displayCurrency === 'AED' ? 1 : rates[displayCurrency] ?? 1;
  const amount = aedCents / 100 / rateToAed;

  return new Intl.NumberFormat(priceLocales[displayCurrency], {
    style: 'currency',
    currency: displayCurrency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function projectionPriceLabel(
  price: ProjectionPrice | null | undefined,
  currency: DisplayCurrency,
  rates: RateMap
): string | null {
  if (!hasPrice(price)) return null;
  if (price.currency === 'AED') {
    return displayPrice(price.priceCents, currency, rates) ?? price.formatted;
  }

  return price.formatted;
}

export function primaryPrice(product: ProjectionCardProduct): ProjectionPrice | null {
  if (hasPrice(product.sellPrice)) return product.sellPrice;
  if ('curatedPrice' in product && hasPrice(product.curatedPrice)) return product.curatedPrice;
  if (hasPrice(product.bestPrice)) return product.bestPrice;
  return null;
}

export function priceLabel(
  product: ProjectionCardProduct,
  currency: DisplayCurrency = 'AED',
  rates: RateMap = { AED: 1 }
): string {
  return projectionPriceLabel(primaryPrice(product), currency, rates) ?? 'Request price';
}

export function compareAtLabel(
  product: ProjectionCardProduct,
  currency: DisplayCurrency = 'AED',
  rates: RateMap = { AED: 1 }
): string | null {
  const primary = primaryPrice(product);
  const compareAt = product.compareAt;

  if (
    !primary ||
    !primary.formatted ||
    !compareAt?.formatted ||
    compareAt.currency !== primary.currency ||
    typeof primary.priceCents !== 'number' ||
    typeof compareAt.priceCents !== 'number' ||
    compareAt.priceCents <= primary.priceCents
  ) {
    return null;
  }

  return projectionPriceLabel(compareAt, currency, rates);
}

export function discountLabel(product: ProjectionCardProduct): string | null {
  const discountPct = product.discountPct;
  if (typeof discountPct !== 'number' || discountPct <= 0) return null;

  const value = Number.isInteger(discountPct)
    ? String(discountPct)
    : discountPct.toFixed(1).replace(/\.0$/, '');
  return `Save ${value}%`;
}

export function imageLabel(product: ProjectionCardProduct): string {
  return product.shortDescription ?? product.name;
}

export function productImageUrl(product: ProjectionCardProduct): string | null {
  return product.primaryImage?.url ?? null;
}

export function specChipLabel(spec: ProjectionSpec): string | null {
  const value = spec.value?.trim();
  if (!value) return null;

  const unit = spec.unit?.trim();
  return [value, unit].filter(Boolean).join(' ');
}
