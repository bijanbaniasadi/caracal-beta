import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(testDir, '..');
const webRoot = resolve(apiRoot, '..', 'web');

function readApiFile(path: string): string {
  return readFileSync(resolve(apiRoot, path), 'utf8');
}

function readWebFile(path: string): string {
  return readFileSync(resolve(webRoot, path), 'utf8');
}

describe('catalog frontend projection invariants', () => {
  it('serves public catalog data from public_products only', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');

    expect(route).toContain('FROM public_products');
    expect(route).not.toMatch(/vendor_raw_products|raw_html|rawVendorHtml/i);
    expect(route).not.toMatch(/masterProduct\.(create|update|delete)/);
  });

  it('keeps frontend search behind the public search API and Typesense alias helper', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');
    const typesense = readApiFile('src/lib/catalog/typesense.ts');
    const frontendClient = readWebFile('src/lib/api/projection-catalog-client.ts');

    expect(route).toContain('searchTypesenseProducts');
    expect(route).not.toMatch(
      /upsertTypesenseProduct|deleteTypesenseProduct|importTypesenseProducts/i
    );
    expect(typesense).toContain('config.collectionAlias');
    expect(frontendClient).toContain('/api/catalog/search');
    expect(frontendClient).not.toMatch(/products_v_|collections\/|typesense|vendor_raw/i);
  });

  it('keeps the legacy shop isolated while new projection pages live under catalog', () => {
    const legacyShop = readWebFile('src/app/shop/page.tsx');
    const catalogPage = readWebFile('src/app/catalog/page.tsx');
    const productPage = readWebFile('src/app/catalog/product/[slug]/page.tsx');
    const siteNav = readWebFile('src/components/site/nav.tsx');

    expect(legacyShop).toContain('ShopContent');
    expect(legacyShop).not.toContain('ProjectionCatalogBrowser');
    expect(catalogPage).toContain('ProjectionCatalogBrowser');
    expect(productPage).toContain('getProjectedProduct');
    expect(siteNav).toContain('NEXT_PUBLIC_NEW_CATALOG_FRONTEND');
    expect(siteNav).toContain("'/catalog'");
    expect(siteNav).toContain("'/shop'");
  });

  it('exposes frontend runtime validation through the public projection health endpoint', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');
    const healthPage = readWebFile('src/app/catalog/health/page.tsx');

    expect(route).toContain('/health');
    expect(route).toContain('public projection accessible');
    expect(route).toContain('Typesense alias healthy');
    expect(route).toContain('image URLs valid');
    expect(route).toContain('product slug valid');
    expect(healthPage).toContain('ProjectionRuntimePanel');
  });
});
