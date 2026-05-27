export const AED_CURRENCY = 'AED';
export const DEFAULT_MARGIN_BPS = 1500;
export const DEFAULT_ROUNDING_INCREMENT_CENTS = 1000;

export type CurrencyRates = Readonly<Record<string, number>>;

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function isValidMoneyInput(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function convertToAed(
  cents: number | bigint | null | undefined,
  currency: string,
  rates: CurrencyRates
): number | null {
  if (cents === null || cents === undefined) return null;

  const numericCents = typeof cents === 'bigint' ? Number(cents) : cents;
  if (!isValidMoneyInput(numericCents)) return null;

  const rate = rates[normalizeCurrency(currency)];
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Math.round(numericCents * rate);
}

export function computeSellPriceAed(
  costAedCents: number | bigint | null | undefined,
  marginBps = DEFAULT_MARGIN_BPS,
  roundCents = DEFAULT_ROUNDING_INCREMENT_CENTS
): number | null {
  if (costAedCents === null || costAedCents === undefined) return null;

  const numericCost = typeof costAedCents === 'bigint' ? Number(costAedCents) : costAedCents;
  if (!isValidMoneyInput(numericCost)) return null;
  if (!Number.isFinite(marginBps) || marginBps < 0) return null;
  if (!Number.isFinite(roundCents) || roundCents <= 0) return null;

  const markedUp = numericCost * (1 + marginBps / 10000);
  return Math.ceil(markedUp / roundCents) * roundCents;
}

export function computeDiscountPct(
  sellPriceCents: number | bigint | null | undefined,
  compareAtCents: number | bigint | null | undefined
): number | null {
  if (sellPriceCents === null || sellPriceCents === undefined) return null;
  if (compareAtCents === null || compareAtCents === undefined) return null;

  const sell = typeof sellPriceCents === 'bigint' ? Number(sellPriceCents) : sellPriceCents;
  const compareAt = typeof compareAtCents === 'bigint' ? Number(compareAtCents) : compareAtCents;

  if (!isValidMoneyInput(sell)) return null;
  if (!Number.isFinite(compareAt) || compareAt <= 0) return null;
  if (compareAt <= sell) return null;

  return Math.floor(((compareAt - sell) * 100) / compareAt);
}
