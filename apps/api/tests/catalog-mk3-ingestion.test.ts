import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  decideMk3Match,
  type Mk3MasterCandidate,
  type Mk3RawMatchInput,
} from '../src/lib/catalog/mk3/matching.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(testDir, '..');

function readApiFile(path: string): string {
  return readFileSync(resolve(apiRoot, path), 'utf8');
}

function raw(overrides: Partial<Mk3RawMatchInput> = {}): Mk3RawMatchInput {
  return {
    id: 1n,
    vendorId: 1n,
    vendorUrl: 'https://www.mk3.com/products/kess-v3',
    vendorSku: 'KESS V3',
    rawName: 'Alientech KESS V3 Slave Kit',
    parsedPriceCents: 100000n,
    parsedCurrency: 'USD',
    parsedInStock: true,
    fingerprint: 'raw-fingerprint',
    rawSpecs: {
      manufacturerSlug: 'alientech',
      manufacturerName: 'Alientech',
      mpnOrSku: 'KESS V3',
      variantKey: 'slave',
    },
    scrapedAt: new Date('2026-05-26T00:00:00.000Z'),
    ...overrides,
  };
}

function candidate(overrides: Partial<Mk3MasterCandidate> = {}): Mk3MasterCandidate {
  return {
    id: 10n,
    name: 'Alientech KESS V3 Master Kit',
    sku: 'KESS V3',
    mpn: 'KESS V3',
    fingerprint: 'different-fingerprint',
    manufacturerSlug: 'alientech',
    manufacturerName: 'Alientech',
    ...overrides,
  };
}

describe('MK3 staged ingestion invariants', () => {
  it('keeps MK3 ingestion worker away from master products and Typesense', () => {
    const worker = readApiFile('src/workers/ingestion-worker.ts');
    const ingestion = readApiFile('src/lib/catalog/mk3/ingestion.ts');
    const combined = `${worker}\n${ingestion}`;

    expect(combined).not.toMatch(/masterProduct\.(create|update|delete)/);
    expect(combined).not.toMatch(/typesense/i);
    expect(combined).not.toMatch(/vendorOffer\.(create|update|upsert)/);
    expect(combined).not.toMatch(/reviewQueue\.(create|update|upsert)/);
  });

  it('keeps MK3 fingerprint worker away from master mutations and Typesense', () => {
    const worker = readApiFile('src/workers/fingerprint-worker.ts');
    const matching = readApiFile('src/lib/catalog/mk3/matching.ts');
    const combined = `${worker}\n${matching}`;

    expect(combined).not.toMatch(/masterProduct\.(create|update|delete)/);
    expect(combined).not.toMatch(/typesense/i);
  });

  it('allows only exact deterministic fingerprint matches to attach offers', () => {
    expect(
      decideMk3Match(raw({ fingerprint: 'exact' }), [candidate({ fingerprint: 'exact' })])
    ).toEqual({
      kind: 'exact',
      confidence: 1,
      productId: 10n,
    });
  });

  it('routes non-exact deterministic candidates into the review queue path', () => {
    const decision = decideMk3Match(raw(), [candidate()]);
    const matching = readApiFile('src/lib/catalog/mk3/matching.ts');

    expect(decision).toMatchObject({
      kind: 'review',
      confidence: 0.8,
      productId: 10n,
    });
    expect(matching).toMatch(/reviewQueue\.create/);
    expect(matching).not.toMatch(/masterProduct\.(create|update|delete)/);
  });
});
