import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  computePricingSnapshot,
  pricingSnapshotUpdateData,
  projectedSellPriceCents,
} from '../pricing-snapshot.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(testDir, '..', '..', '..', '..');
const globalPolicy = {
  scope: 'global',
  vendorId: null,
  marginBps: 1500,
  roundingIncrementCents: 1000n,
};

describe('catalog pricing snapshots', () => {
  it('computes the frozen sell-price snapshot used when a master is published', () => {
    const snapshot = computePricingSnapshot({
      offers: [{ id: 1n, vendorId: 7n, priceCents: 349800n, currency: 'USD' }],
      rates: { AED: 1, USD: 3.6725 },
      policies: [globalPolicy],
      now: new Date('2026-05-27T17:00:00.000Z'),
    });

    expect(snapshot?.sellPriceCents).toBe(1478000);
    expect(snapshot?.currency).toBe('AED');
    expect(snapshot?.sourceCostCents).toBe(349800);
    expect(snapshot?.sourceCurrency).toBe('USD');
    expect(snapshot?.fxRateToAed).toBe(3.6725);
    expect(snapshot?.marginBps).toBe(1500);
    expect(pricingSnapshotUpdateData(snapshot).pricedSellCents).toBe(1478000n);
  });

  it('keeps projection sell price stable across FX moves until explicit reprice', () => {
    const initialSnapshot = computePricingSnapshot({
      offers: [{ id: 1n, vendorId: 9n, priceCents: 10000n, currency: 'EUR' }],
      rates: { AED: 1, EUR: 4 },
      policies: [globalPolicy],
    });
    const liveComputedAfterFxMove = computePricingSnapshot({
      offers: [{ id: 1n, vendorId: 9n, priceCents: 10000n, currency: 'EUR' }],
      rates: { AED: 1, EUR: 5 },
      policies: [globalPolicy],
    });

    expect(initialSnapshot?.sellPriceCents).toBe(46000);
    expect(liveComputedAfterFxMove?.sellPriceCents).toBe(58000);
    expect(
      projectedSellPriceCents(
        initialSnapshot?.sellPriceCents,
        liveComputedAfterFxMove?.sellPriceCents
      )
    ).toBe(46000);
    expect(liveComputedAfterFxMove?.sellPriceCents).not.toBe(initialSnapshot?.sellPriceCents);
  });

  it('freezes an AED compare-at from the source RRP when it is an honest discount', () => {
    const snapshot = computePricingSnapshot({
      offers: [{ id: 1n, vendorId: 9n, priceCents: 10000n, currency: 'EUR' }],
      rates: { AED: 1, EUR: 4 },
      policies: [globalPolicy],
      rrpSource: { cents: 15000n, currency: 'EUR' },
    });

    expect(snapshot?.sellPriceCents).toBe(46000);
    expect(snapshot?.compareAtCents).toBe(60000);
    expect(snapshot?.compareAtCurrency).toBe('AED');
    expect(snapshot?.compareAtSourceCents).toBe(15000);
    expect(snapshot?.compareAtSourceCurrency).toBe('EUR');

    const data = pricingSnapshotUpdateData(snapshot);
    expect(data.compareAtCents).toBe(60000n);
    expect(data.compareAtCurrency).toBe('AED');
  });

  it('suppresses compare-at when the RRP does not beat the sell price (no fake discount)', () => {
    const snapshot = computePricingSnapshot({
      offers: [{ id: 1n, vendorId: 9n, priceCents: 10000n, currency: 'EUR' }],
      rates: { AED: 1, EUR: 4 },
      policies: [globalPolicy],
      rrpSource: { cents: 11000n, currency: 'EUR' }, // 44000 AED <= 46000 sell
    });

    expect(snapshot?.sellPriceCents).toBe(46000);
    expect(snapshot?.compareAtCents).toBeNull();
    expect(snapshot?.compareAtCurrency).toBeNull();
    expect(pricingSnapshotUpdateData(snapshot).compareAtCents).toBeNull();
  });

  it('adds the source RRP columns the compare-at freeze depends on', () => {
    const migration = readFileSync(
      resolve(
        apiRoot,
        'prisma/migrations/20260528120000_pricing_snapshot_rrp_freeze/migration.sql'
      ),
      'utf8'
    );

    expect(migration).toContain('rrp_source_cents');
    expect(migration).toContain('rrp_source_currency');
  });

  it('makes the materialized view prefer the frozen snapshot over live fallback pricing', () => {
    const migration = readFileSync(
      resolve(
        apiRoot,
        'prisma/migrations/20260527210000_pricing_snapshot_freeze/migration.sql'
      ),
      'utf8'
    );

    expect(migration).toContain(
      'COALESCE(mp.priced_sell_cents, computed_price.sell_price_cents)'
    );
    expect(migration).toContain('priced_source_cost_cents');
    expect(migration).toContain('priced_fx_rate_to_aed');
  });
});
