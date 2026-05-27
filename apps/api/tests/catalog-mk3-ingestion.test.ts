import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { verifyCatalogRawAsset } from '../src/lib/catalog/object-storage.js';
import { downloadMk3Image, isMk3PathAllowedByRobots } from '../src/lib/catalog/mk3/fetch.js';
import { extractMk3ProductsFromHtml } from '../src/lib/catalog/mk3/extract.js';
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
    const fetcher = readApiFile('src/lib/catalog/mk3/fetch.ts');
    const combined = `${worker}\n${ingestion}`;

    expect(combined).not.toMatch(/masterProduct\.(create|update|delete)/);
    expect(combined).not.toMatch(/typesense/i);
    expect(combined).not.toMatch(/vendorOffer\.(create|update|upsert)/);
    expect(combined).not.toMatch(/reviewQueue\.(create|update|upsert)/);
    expect(fetcher).not.toMatch(/writeCatalogRawAsset\('mk3-html'/);
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

  it('extracts live MK3 EUR pricing and explicit RRP without storing markup', () => {
    const html = `
      <html>
        <body>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Autotuner Master Tool",
              "sku": "AT-MASTER",
              "brand": {"name": "Autotuner"},
              "description": "Bench and OBD tuning tool",
              "image": ["https://www.mk3.com/cdn/shop/files/autotuner.jpg"],
              "offers": {
                "@type": "Offer",
                "price": "1599.00",
                "priceCurrency": "EUR",
                "availability": "https://schema.org/InStock"
              }
            }
          </script>
          <span>RRP: €1899.00</span>
        </body>
      </html>
    `;

    const [product] = extractMk3ProductsFromHtml(
      html,
      'https://www.mk3.com/products/autotuner-master-tool',
      'https://www.mk3.com'
    );

    expect(product).toBeDefined();
    if (!product) throw new Error('expected product');

    expect(product).toMatchObject({
      vendorSku: 'AT-MASTER',
      rawName: 'Autotuner Master Tool',
      parsedCurrency: 'EUR',
      rrpCurrency: 'EUR',
      parsedInStock: true,
    });
    expect(product.parsedPriceCents).toBe(159900n);
    expect(product.rrpCents).toBe(189900n);
    expect(product.rawDescription).toBe('Bench and OBD tuning tool');
  });

  it('discovers nopCommerce product-title links from MK3 category pages', () => {
    const [product] = extractMk3ProductsFromHtml(
      '<h2 class="product-title"><a href="/mkon331">AutoTuner Tool Device Slave Version</a></h2>',
      'https://www.mk3.com/autotuner-tool',
      'https://www.mk3.com'
    );

    expect(product).toBeDefined();
    if (!product) throw new Error('expected product link');
    expect(product.vendorUrl).toBe('https://www.mk3.com/mkon331');
    expect(product.rawSpecs).toMatchObject({ source: 'product-link' });
  });

  it('prefers EUR prices from nopCommerce product pages when USD is also displayed', () => {
    const [product] = extractMk3ProductsFromHtml(
      `
        <html>
          <head>
            <title>AutoTuner Tool - Upgrade from Slave to Master | MK3</title>
            <meta name="description" content="Software Activation From Autotuner Tool">
            <meta property="og:image" content="/images/uploaded/products/product/MK23754/main.jpg">
          </head>
          <body>
            <h1>AutoTuner Tool - Upgrade from Slave to Master</h1>
            <span>SKU: MK23754</span>
            <span>$2,588.24 (€2200,00)</span>
            <span>Category: Software Activation</span>
            <span>Manufacturer: Autotuner Tool</span>
            <span>Availability: In stock</span>
          </body>
        </html>
      `,
      'https://www.mk3.com/autotuner-tool-upgrade-from-slave-to-master',
      'https://www.mk3.com'
    );

    expect(product).toBeDefined();
    if (!product) throw new Error('expected product page fallback');
    expect(product.vendorSku).toBe('MK23754');
    expect(product.rawPriceText).toBe('€2200,00');
    expect(product.parsedCurrency).toBe('EUR');
    expect(product.parsedPriceCents).toBe(220000n);
    expect(product.rawImageUrls).toEqual([
      'https://www.mk3.com/images/uploaded/products/product/MK23754/main.jpg',
    ]);
  });

  it('honors robots.txt disallow rules for live MK3 paths', () => {
    const robots = `
      User-agent: *
      Disallow: /account
      Disallow: /collections/private
      Allow: /collections/private/allowed-product
    `;

    expect(
      isMk3PathAllowedByRobots(
        robots,
        'CaracalTechMotorsCatalogBot/1.0',
        'https://www.mk3.com/collections/all'
      )
    ).toBe(true);
    expect(
      isMk3PathAllowedByRobots(
        robots,
        'CaracalTechMotorsCatalogBot/1.0',
        'https://www.mk3.com/collections/private'
      )
    ).toBe(false);
    expect(
      isMk3PathAllowedByRobots(
        robots,
        'CaracalTechMotorsCatalogBot/1.0',
        'https://www.mk3.com/collections/private/allowed-product'
      )
    ).toBe(true);
  });

  it('stores fixture data-url images through the raw asset abstraction', async () => {
    const previousRawAssetDir = process.env.CATALOG_RAW_ASSET_DIR;
    const rawAssetDir = await mkdtemp(resolve(tmpdir(), 'mk3-fixture-image-'));
    process.env.CATALOG_RAW_ASSET_DIR = rawAssetDir;

    try {
      const image = await downloadMk3Image(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
      );
      const verification = await verifyCatalogRawAsset(image.storageKey);

      expect(image.mimeType).toBe('image/png');
      expect(image.bytes).toBeGreaterThan(0);
      expect(image.storageKey).toMatch(/^local:\/\/catalog-raw\/mk3-images\//);
      expect(verification.exists).toBe(true);
    } finally {
      if (previousRawAssetDir === undefined) {
        delete process.env.CATALOG_RAW_ASSET_DIR;
      } else {
        process.env.CATALOG_RAW_ASSET_DIR = previousRawAssetDir;
      }
      await rm(rawAssetDir, { recursive: true, force: true });
    }
  });
});
