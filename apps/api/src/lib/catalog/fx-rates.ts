import { getPrismaClient } from '@caracal/db';
import type { PrismaClient } from '@prisma/client';

import { logger } from '../logger.js';

export const FX_RATE_REFRESH_EVERY_MS = 7_200_000;
export const MAX_RATE_SWING_FRACTION = 0.1;
export const FIXED_RATE_TO_AED = {
  AED: 1,
  USD: 3.6725,
} as const;

export interface CurrencyRateSnapshot {
  currency: string;
  rateToAed: number;
}

export interface CurrencyRateUpdate {
  currency: string;
  rateToAed: number;
}

export interface CurrencyRateStore {
  readRates(): Promise<CurrencyRateSnapshot[]>;
  writeRates(updates: CurrencyRateUpdate[]): Promise<void>;
}

export interface RateFetchSource {
  source: 'open-er-api' | 'frankfurter';
  ratesToAed: Record<string, number>;
}

export interface RatePlan {
  accepted: CurrencyRateUpdate[];
  skipped: Array<{
    currency: string;
    reason: 'fixed-peg' | 'missing-fetched-rate' | 'invalid-fetched-rate' | 'swing-too-large';
    currentRateToAed?: number;
    nextRateToAed?: number;
  }>;
}

export interface FxRateRefreshResult extends RatePlan {
  action: 'updated' | 'no-updates' | 'fetch-failed';
  source?: RateFetchSource['source'];
  targetCurrencies: string[];
}

const DEFAULT_FLOATING_CURRENCIES = ['EUR', 'GBP'];
const PRIMARY_URL = 'https://open.er-api.com/v6/latest/AED';
const FALLBACK_URL = 'https://api.frankfurter.app/latest?from=AED';

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function isFixedPeg(currency: string): boolean {
  return Object.prototype.hasOwnProperty.call(FIXED_RATE_TO_AED, normalizeCurrency(currency));
}

function isValidRate(rate: number | undefined): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

export function normalizeRatesToAed(
  baseCurrency: string,
  ratesPerBase: Record<string, unknown>
): Record<string, number> {
  if (normalizeCurrency(baseCurrency) !== 'AED') {
    throw new Error(`Unsupported FX base currency: ${baseCurrency}`);
  }

  const normalized: Record<string, number> = { AED: 1 };
  for (const [currency, rawRatePerAed] of Object.entries(ratesPerBase)) {
    const code = normalizeCurrency(currency);
    const ratePerAed =
      typeof rawRatePerAed === 'number' ? rawRatePerAed : Number.parseFloat(String(rawRatePerAed));

    if (!isValidRate(ratePerAed)) continue;
    normalized[code] = code === 'AED' ? 1 : 1 / ratePerAed;
  }

  return normalized;
}

async function readJsonResponse(
  fetchImpl: typeof fetch,
  url: string
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`FX rate fetch failed from ${url}: ${response.status}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function fetchLatestRatesToAed(
  fetchImpl: typeof fetch = fetch
): Promise<RateFetchSource> {
  try {
    const body = await readJsonResponse(fetchImpl, PRIMARY_URL);
    const rates = body.rates;
    if (!rates || typeof rates !== 'object') {
      throw new Error('open.er-api response did not include rates');
    }

    return {
      source: 'open-er-api',
      ratesToAed: normalizeRatesToAed(String(body.base_code ?? 'AED'), rates as Record<string, unknown>),
    };
  } catch (error) {
    logger.warn({ err: error }, 'primary FX rate source failed; trying fallback');
  }

  const body = await readJsonResponse(fetchImpl, FALLBACK_URL);
  const rates = body.rates;
  if (!rates || typeof rates !== 'object') {
    throw new Error('frankfurter response did not include rates');
  }

  return {
    source: 'frankfurter',
    ratesToAed: normalizeRatesToAed(String(body.base ?? 'AED'), rates as Record<string, unknown>),
  };
}

export function shouldAcceptRateSwing(
  currentRateToAed: number | undefined,
  nextRateToAed: number,
  maxSwingFraction = MAX_RATE_SWING_FRACTION
): boolean {
  if (!isValidRate(nextRateToAed)) return false;
  if (currentRateToAed === undefined || !isValidRate(currentRateToAed)) return true;

  return Math.abs(nextRateToAed - currentRateToAed) / currentRateToAed <= maxSwingFraction + Number.EPSILON;
}

export function planCurrencyRateUpdates(input: {
  currentRates: CurrencyRateSnapshot[];
  fetchedRatesToAed: Record<string, number>;
  targetCurrencies?: string[];
  maxSwingFraction?: number;
}): RatePlan {
  const current = new Map(
    input.currentRates.map((rate) => [normalizeCurrency(rate.currency), rate.rateToAed])
  );
  const targetCurrencies = Array.from(
    new Set([
      ...DEFAULT_FLOATING_CURRENCIES,
      ...input.currentRates.map((rate) => normalizeCurrency(rate.currency)),
      ...(input.targetCurrencies ?? []).map(normalizeCurrency),
    ])
  ).sort();
  const accepted: CurrencyRateUpdate[] = [];
  const skipped: RatePlan['skipped'] = [];

  for (const currency of targetCurrencies) {
    if (isFixedPeg(currency)) {
      skipped.push({ currency, reason: 'fixed-peg' });
      continue;
    }

    const nextRateToAed = input.fetchedRatesToAed[currency];
    if (nextRateToAed === undefined) {
      skipped.push({ currency, reason: 'missing-fetched-rate' });
      continue;
    }

    if (!isValidRate(nextRateToAed)) {
      skipped.push({ currency, reason: 'invalid-fetched-rate', nextRateToAed });
      continue;
    }

    const currentRateToAed = current.get(currency);
    if (
      !shouldAcceptRateSwing(
        currentRateToAed,
        nextRateToAed,
        input.maxSwingFraction ?? MAX_RATE_SWING_FRACTION
      )
    ) {
      skipped.push({
        currency,
        reason: 'swing-too-large',
        currentRateToAed,
        nextRateToAed,
      });
      continue;
    }

    accepted.push({ currency, rateToAed: nextRateToAed });
  }

  return { accepted, skipped };
}

export function createPrismaCurrencyRateStore(
  prisma: PrismaClient = getPrismaClient()
): CurrencyRateStore {
  return {
    async readRates() {
      const rows = await prisma.currencyRate.findMany({
        select: {
          currency: true,
          rateToAed: true,
        },
      });

      return rows.map((row) => ({
        currency: row.currency,
        rateToAed: Number(row.rateToAed),
      }));
    },

    async writeRates(updates) {
      if (updates.length === 0) return;

      const now = new Date();
      await prisma.$transaction(
        updates.map((update) =>
          prisma.currencyRate.upsert({
            where: { currency: update.currency },
            create: {
              currency: update.currency,
              baseCurrency: 'AED',
              rateToAed: update.rateToAed,
              updatedAt: now,
            },
            update: {
              baseCurrency: 'AED',
              rateToAed: update.rateToAed,
              updatedAt: now,
            },
          })
        )
      );
    },
  };
}

export async function refreshFloatingCurrencyRates(input: {
  store?: CurrencyRateStore;
  fetchRates?: () => Promise<RateFetchSource>;
  targetCurrencies?: string[];
} = {}): Promise<FxRateRefreshResult> {
  const store = input.store ?? createPrismaCurrencyRateStore();
  const currentRates = await store.readRates();
  const targetCurrencies = Array.from(
    new Set([
      ...DEFAULT_FLOATING_CURRENCIES,
      ...currentRates.map((rate) => normalizeCurrency(rate.currency)),
      ...(input.targetCurrencies ?? []).map(normalizeCurrency),
    ])
  ).sort();

  let fetched: RateFetchSource;
  try {
    fetched = await (input.fetchRates ?? fetchLatestRatesToAed)();
  } catch (error) {
    logger.warn({ err: error, targetCurrencies }, 'FX rate refresh failed; keeping last-good rates');
    return {
      action: 'fetch-failed',
      accepted: [],
      skipped: [],
      targetCurrencies,
    };
  }

  const plan = planCurrencyRateUpdates({
    currentRates,
    fetchedRatesToAed: fetched.ratesToAed,
    targetCurrencies: input.targetCurrencies,
  });

  for (const skipped of plan.skipped) {
    if (skipped.reason === 'swing-too-large') {
      logger.warn(skipped, 'FX rate update skipped because swing exceeded guardrail');
    }
  }

  await store.writeRates(plan.accepted);

  return {
    action: plan.accepted.length > 0 ? 'updated' : 'no-updates',
    source: fetched.source,
    targetCurrencies,
    ...plan,
  };
}
