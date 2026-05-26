import { existsSync, readFileSync } from 'node:fs';
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
    expect(typesense).toContain('category_name');
    expect(typesense).toContain('currency');
    expect(frontendClient).toContain('/api/catalog/search');
    expect(frontendClient).not.toMatch(/products_v_|collections\/|typesense|vendor_raw/i);
  });

  it('rejects q on browse APIs and keeps search-only q routing', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');
    const frontendClient = readWebFile('src/lib/api/projection-catalog-client.ts');

    expect(route).toContain('Use /api/catalog/search for q searches.');
    expect(frontendClient).toContain('paramsToListQuery');
    expect(frontendClient.match(/q: params\?\.q/g) ?? []).toHaveLength(1);
  });

  it('does not expose public internal projection fields', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');
    const frontendTypes = readWebFile('src/lib/api/projection-catalog-types.ts');
    const migration = readApiFile(
      'prisma/migrations/20260526234000_projection_rollout_hardening/migration.sql'
    );

    expect(frontendTypes).not.toMatch(/storageKey|selectedOfferId|lastSeenAt|confidence/);
    expect(route).not.toMatch(/storageKey:|selectedOfferId|lastSeenAt|confidence:/);
    expect(migration).not.toMatch(/selected_offer_id|last_seen_at|confidence/);
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

  it('gates catalog pages with runtime feature flag rollback', () => {
    const middleware = readWebFile('src/middleware.ts');
    const siteNav = readWebFile('src/components/site/nav.tsx');

    expect(middleware).toContain('isProjectionCatalogEnabled');
    expect(middleware).toContain('legacy-rollback');
    expect(middleware).toContain("'/catalog'");
    expect(middleware).toContain("'/shop'");
    expect(siteNav).toContain('NEXT_PUBLIC_NEW_CATALOG_FRONTEND');
  });

  it('keeps projection health behind admin auth', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');
    const adminRoute = readApiFile('src/routes/admin-catalog-curation.ts');
    const adminClient = readWebFile('src/lib/api/admin-curation-client.ts');

    expect(route).not.toContain('/health');
    expect(adminRoute).toContain('/projection-health');
    expect(adminClient).toContain('/api/admin/catalog/curation/projection-health');
    expect(existsSync(resolve(webRoot, 'src/app/catalog/health/page.tsx'))).toBe(false);
  });

  it('gates robots and keeps catalog out of the sitemap until cutover', () => {
    const robots = readWebFile('src/app/robots.ts');
    const sitemap = readWebFile('src/app/sitemap.ts');

    expect(robots).toContain('CATALOG_ROBOTS_ALLOW');
    expect(robots).toContain("'/catalog'");
    expect(sitemap).not.toContain('/catalog');
  });

  it('adds cache headers, count caching, SSR seed data, and hydration caching', () => {
    const route = readApiFile('src/routes/catalog-projection.ts');
    const page = readWebFile('src/app/catalog/page.tsx');
    const browser = readWebFile('src/components/catalog-projection/projection-catalog-browser.tsx');

    expect(route).toContain('Cache-Control');
    expect(route).toContain('countCache');
    expect(page).toContain('getInitialProjectedCatalogPage');
    expect(browser).toContain('useQuery');
    expect(browser).toContain('initialData');
  });

  it('renders projected catalog images through next/image only', () => {
    const card = readWebFile('src/components/catalog-projection/projection-product-card.tsx');
    const detail = readWebFile('src/components/catalog-projection/projection-product-detail.tsx');

    expect(card).toContain("from 'next/image'");
    expect(detail).toContain("from 'next/image'");
    expect(card).not.toContain('<img');
    expect(detail).not.toContain('<img');
  });
});
