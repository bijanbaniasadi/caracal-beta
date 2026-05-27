import { describe, expect, it, vi } from 'vitest';

import {
  fetchLatestRatesToAed,
  normalizeRatesToAed,
  planCurrencyRateUpdates,
  refreshFloatingCurrencyRates,
  shouldAcceptRateSwing,
  type CurrencyRateStore,
} from '../fx-rates.js';

describe('catalog FX rate refresh', () => {
  it('normalizes AED-base API rates into AED-per-currency rates', () => {
    const rates = normalizeRatesToAed('AED', {
      AED: 1,
      USD: 0.272294,
      EUR: 0.25,
      GBP: 0.2150537634,
    });

    expect(rates.AED).toBe(1);
    expect(rates.USD).toBeCloseTo(3.6725, 4);
    expect(rates.EUR).toBe(4);
    expect(rates.GBP).toBeCloseTo(4.65, 4);
  });

  it('rejects rate swings greater than 10 percent', () => {
    expect(shouldAcceptRateSwing(4, 4.4)).toBe(true);
    expect(shouldAcceptRateSwing(4, 4.41)).toBe(false);

    const plan = planCurrencyRateUpdates({
      currentRates: [
        { currency: 'EUR', rateToAed: 4 },
        { currency: 'GBP', rateToAed: 4.65 },
      ],
      fetchedRatesToAed: {
        EUR: 4.41,
        GBP: 4.8,
      },
      targetCurrencies: ['EUR', 'GBP'],
    });

    expect(plan.accepted).toEqual([{ currency: 'GBP', rateToAed: 4.8 }]);
    expect(plan.skipped).toContainEqual({
      currency: 'EUR',
      reason: 'swing-too-large',
      currentRateToAed: 4,
      nextRateToAed: 4.41,
    });
  });

  it('protects AED and USD fixed pegs from API updates', () => {
    const plan = planCurrencyRateUpdates({
      currentRates: [
        { currency: 'AED', rateToAed: 1 },
        { currency: 'USD', rateToAed: 3.6725 },
        { currency: 'EUR', rateToAed: 4 },
      ],
      fetchedRatesToAed: {
        AED: 99,
        USD: 99,
        EUR: 4.01,
      },
      targetCurrencies: ['AED', 'USD', 'EUR'],
    });

    expect(plan.accepted).toEqual([{ currency: 'EUR', rateToAed: 4.01 }]);
    expect(plan.skipped).toContainEqual({ currency: 'AED', reason: 'fixed-peg' });
    expect(plan.skipped).toContainEqual({ currency: 'USD', reason: 'fixed-peg' });
  });

  it('keeps last-good rates when both HTTP sources fail', async () => {
    const writes: unknown[] = [];
    const store: CurrencyRateStore = {
      async readRates() {
        return [{ currency: 'EUR', rateToAed: 4 }];
      },
      async writeRates(updates) {
        writes.push(...updates);
      },
    };

    const result = await refreshFloatingCurrencyRates({
      store,
      fetchRates: async () => {
        throw new Error('network unavailable');
      },
      targetCurrencies: ['EUR'],
    });

    expect(result.action).toBe('fetch-failed');
    expect(result.accepted).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('falls back to Frankfurter when the primary HTTP source fails', async () => {
    const responses = [
      new Response('unavailable', { status: 503 }),
      new Response(
        JSON.stringify({
          base: 'AED',
          rates: {
            EUR: 0.25,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ),
    ];
    const fetchMock = vi.fn(async () => {
      const response = responses.shift();
      if (!response) throw new Error('unexpected fetch call');
      return response;
    }) as unknown as typeof fetch;

    const result = await fetchLatestRatesToAed(fetchMock);

    expect(result.source).toBe('frankfurter');
    expect(result.ratesToAed.EUR).toBe(4);
  });

  it('parses the primary HTTP source when available', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          base_code: 'AED',
          rates: {
            EUR: 0.25,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const result = await fetchLatestRatesToAed(fetchMock);

    expect(result.source).toBe('open-er-api');
    expect(result.ratesToAed.EUR).toBe(4);
  });
});
