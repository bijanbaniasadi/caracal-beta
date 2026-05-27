/**
 * MK3 chain-validation seed (manual, local-only).
 *
 * Purpose: prove the full pipeline produces a correct, FROZEN EUR→AED product
 * end-to-end without any crawler and without touching mk3.com:
 *
 *   real EUR product data  ->  vendor_raw_products (real ingestion path, offline data: images)
 *                          ->  master_products + EUR vendor_offers (curation)
 *                          ->  publish (A3 snapshot freezes AED sell price)
 *                          ->  public_products matview + Typesense
 *                          ->  /api/catalog/products + currency selector
 *
 * It is NOT a crawler. Products are supplied by hand below (copied from mk3.com
 * in a browser — the site only blocks automated fetches, not humans). Everything
 * is tagged with the `mk3-validation-seed` run label and the `mk3-validation-seed-`
 * slug prefix so `mk3-validation-seed-purge.ts` can remove it cleanly.
 *
 * Run (full local Docker stack must be up: postgres + redis + typesense):
 *   pnpm --filter @caracal/api exec tsx scripts/mk3-validation-seed.ts
 *
 * Then verify on the site (browse + header currency selector) and run the purge
 * script when you are done.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

import {
  buildMasterPricingSnapshotUpdate,
} from '../src/lib/catalog/pricing-snapshot.js';
import {
  projectMasterProductToSearch,
  refreshPublicProductsMaterializedViewDebounced,
} from '../src/lib/catalog/projection.js';
import {
  ensureMk3VendorSource,
  runMk3Ingestion,
} from '../src/lib/catalog/mk3/ingestion.js';
import { ensureStageUser } from './seed-mk3-stage1-references.js';

// --------------------------------------------------------------------------
// 1) PRODUCT INPUT — replace these placeholders with real mk3.com products.
//    Open mk3.com in your browser and copy real values. Keep 1-2 rows WITH a
//    genuine RRP (manufacturer/list price shown on the page) and 1-2 WITHOUT,
//    so both the honest-discount and no-discount paths are exercised.
//    Never invent an RRP. For a discount to show, the RRP must be comfortably
//    above (cost x 1.15) once converted to AED.
// --------------------------------------------------------------------------
interface ValidationProductInput {
  slug: string; // short kebab id; final slug becomes `mk3-validation-seed-<slug>`
  name: string;
  sku: string;
  brand: string;
  description: string;
  /** Offer (vendor cost) price as it appears on the page, EUR. e.g. "1480.00" */
  priceEur: string;
  /** Manufacturer RRP / list price in EUR, or null if the page shows none. e.g. "1690.00" */
  rrpEur: string | null;
  inStock: boolean;
}

const VALIDATION_PRODUCTS: ValidationProductInput[] = [
  {
    // TODO: replace with a real mk3.com product that shows an RRP / list price
    slug: 'sample-with-rrp-1',
    name: 'TODO Replace — Tool With RRP 1',
    sku: 'TODO-SKU-1',
    brand: 'Autotuner',
    description:
      'TODO: paste the real product description copied from mk3.com. Plain text only.',
    priceEur: '1480.00',
    rrpEur: '1990.00',
    inStock: true,
  },
  {
    // TODO: replace with a real mk3.com product that shows an RRP / list price
    slug: 'sample-with-rrp-2',
    name: 'TODO Replace — Tool With RRP 2',
    sku: 'TODO-SKU-2',
    brand: 'Alientech',
    description: 'TODO: paste the real product description copied from mk3.com.',
    priceEur: '2150.00',
    rrpEur: '2790.00',
    inStock: true,
  },
  {
    // TODO: replace with a real mk3.com product that shows NO RRP
    slug: 'sample-no-rrp-1',
    name: 'TODO Replace — Tool Without RRP',
    sku: 'TODO-SKU-3',
    brand: 'CMD',
    description: 'TODO: paste the real product description copied from mk3.com.',
    priceEur: '640.00',
    rrpEur: null,
    inStock: true,
  },
];

const SLUG_PREFIX = 'mk3-validation-seed-';
const RUN_LABEL = 'mk3-validation-seed';
const VALIDATION_CATEGORY_SLUG = 'mk3-validation-tools';

// 1x1 transparent PNG, embedded as a data: URL so image download is fully
// offline (downloadMk3Image handles data: URLs without any network call).
const PLACEHOLDER_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// --------------------------------------------------------------------------
// Local-stack env defaults (mirrors the proven Stage 1 harness).
// --------------------------------------------------------------------------
const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '..');
const repoRoot = resolve(apiRoot, '..', '..');
const fixturePath = resolve(apiRoot, 'fixtures', 'mk3-validation-seed.generated.json');

process.env.DATABASE_URL ??= 'postgresql://caracal:caracal_dev@localhost:5432/caracal_dev';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.TYPESENSE_URL ??= 'http://localhost:8108';
process.env.TYPESENSE_API_KEY ??= 'dev-typesense-key';
process.env.TYPESENSE_COLLECTION_ALIAS ??= 'products';
process.env.TYPESENSE_COLLECTION_PREFIX ??= 'products';
process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ??= '0';
process.env.CATALOG_RAW_ASSET_DIR ??= resolve(repoRoot, 'tmp', 'mk3-validation-catalog-raw');
process.env.MK3_INGESTION_FIXTURE_PATH = fixturePath;

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

function priceEurToCents(value: string): bigint {
  const normalized = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(normalized)) {
    throw new Error(`Invalid EUR price "${value}".`);
  }
  return BigInt(Math.round(normalized * 100));
}

/** Build a JSON-LD product page so the real extractor (extract.ts) parses it. */
function buildFixturePage(input: ValidationProductInput, baseUrl: string) {
  const vendorUrl = `${baseUrl}/products/${SLUG_PREFIX}${input.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    sku: input.sku,
    brand: { '@type': 'Brand', name: input.brand },
    description: input.description,
    image: [PLACEHOLDER_PNG_DATA_URL],
    url: vendorUrl,
    offers: {
      '@type': 'Offer',
      price: input.priceEur,
      priceCurrency: 'EUR',
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };
  // RRP is surfaced to the raw layer via a compare_at_price marker (cents),
  // exactly as the extractor's parseRrpFromHtml() expects. EUR symbol in the
  // page lets it tag the RRP currency as EUR.
  const rrpMarker = input.rrpEur
    ? `<script type="application/json" data-rrp="true">{"compare_at_price": ${priceEurToCents(
        input.rrpEur
      ).toString()}, "currency": "EUR"}</script>`
    : '';
  const html = `<!doctype html><html><head>
<meta charset="utf-8" />
<title>${input.name}</title>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${rrpMarker}
</head><body><h1>${input.name}</h1><p>Price: &euro;${input.priceEur}</p></body></html>`;

  return { url: vendorUrl, html };
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  const creator = await ensureStageUser({
    id: 'mk3-validation-creator',
    email: 'mk3.validation.creator@caracal.local',
    name: 'MK3 Validation Creator',
    role: 'ADMIN',
  });
  const publisher = await ensureStageUser({
    id: 'mk3-validation-publisher',
    email: 'mk3.validation.publisher@caracal.local',
    name: 'MK3 Validation Publisher',
    role: 'ADMIN',
  });

  const vendor = await ensureMk3VendorSource();
  const baseUrl = vendor.baseUrl.replace(/\/+$/, '');

  // Validation category (reused / created idempotently).
  const existingCategory = await prisma.catalogCategory.findFirst({
    where: { parentId: null, slug: VALIDATION_CATEGORY_SLUG },
  });
  const category = existingCategory
    ? existingCategory
    : await prisma.catalogCategory.create({
        data: {
          slug: VALIDATION_CATEGORY_SLUG,
          name: 'MK3 Validation Tools',
          description: 'Local-only chain-validation category for MK3 EUR seed products.',
        },
      });

  // Write the generated fixture and run the REAL ingestion path.
  await mkdir(dirname(fixturePath), { recursive: true });
  await mkdir(process.env.CATALOG_RAW_ASSET_DIR as string, { recursive: true });
  const pages = VALIDATION_PRODUCTS.map((product) => buildFixturePage(product, baseUrl));
  await writeFile(fixturePath, JSON.stringify({ pages }, null, 2), 'utf8');

  const ingestion = await runMk3Ingestion({
    vendorSourceId: vendor.id.toString(),
    requestedBy: RUN_LABEL,
    trigger: 'manual',
    fullCrawl: true,
    limit: VALIDATION_PRODUCTS.length,
  });
  const runId = BigInt(ingestion.ingestionRunId);

  const rawProducts = await prisma.vendorRawProduct.findMany({
    where: { ingestionRunId: runId },
    include: { images: true },
    orderBy: { id: 'asc' },
  });

  // EUR rate for RRP -> AED compare-at conversion (matview only honors AED
  // compare-at). NOTE: A3 freezes the sell price but does NOT auto-convert the
  // EUR RRP into compare_at_cents, so curation does it here.
  const rateRows = await prisma.currencyRate.findMany({
    select: { currency: true, rateToAed: true },
  });
  const rates = rateRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.currency.trim().toUpperCase()] = row.rateToAed.toNumber();
    return acc;
  }, {});

  const published: Array<{
    slug: string;
    masterId: string;
    sourceCostCents: string | null;
    sourceCurrency: string | null;
    pricedSellCents: string | null;
    compareAtCents: string | null;
  }> = [];

  for (const raw of rawProducts) {
    // Fixture vendorUrl is `${baseUrl}/products/mk3-validation-seed-<slug>`, so
    // the path tail already carries the prefix. Fall back to the raw id.
    const urlTail = raw.vendorUrl.split('/products/').pop();
    const finalSlug =
      urlTail && urlTail.startsWith(SLUG_PREFIX) ? urlTail : `${SLUG_PREFIX}${raw.id.toString()}`;

    const brandName =
      (raw.rawSpecs && typeof raw.rawSpecs === 'object' && 'manufacturerName' in raw.rawSpecs
        ? String((raw.rawSpecs as Record<string, unknown>).manufacturerName)
        : null) ?? 'MK3';
    const manufacturerSlug =
      (raw.rawSpecs && typeof raw.rawSpecs === 'object' && 'manufacturerSlug' in raw.rawSpecs
        ? String((raw.rawSpecs as Record<string, unknown>).manufacturerSlug)
        : null) ?? 'mk3';

    const manufacturer = await prisma.manufacturer.upsert({
      where: { slug: manufacturerSlug },
      create: { slug: manufacturerSlug, name: brandName },
      update: { name: brandName },
    });

    // Carry the source RRP (vendor currency, EUR) onto the master. A3.1 freezes
    // it into an AED compare-at at publish — no manual conversion here.
    const rrpSourceCents = raw.rrpCents;
    const rrpSourceCurrency = raw.rrpCurrency ? raw.rrpCurrency.toUpperCase() : null;

    // Create / update the master in PENDING_REVIEW (creator), then publish as
    // the publisher (two-person spirit). Publish freezes the AED sell price.
    const master = await prisma.masterProduct.upsert({
      where: { slug: finalSlug },
      create: {
        slug: finalSlug,
        sku: raw.vendorSku ?? raw.id.toString(),
        mpn: raw.vendorSku,
        name: raw.rawName ?? finalSlug,
        shortDescription: (raw.rawDescription ?? '').slice(0, 200) || 'MK3 validation seed product.',
        longDescriptionMd:
          raw.rawDescription ??
          'MK3 chain-validation seed product. Local-only; remove with the purge script.',
        rrpSourceCents,
        rrpSourceCurrency,
        manufacturerId: manufacturer.id,
        manufacturerSlug: manufacturer.slug,
        manufacturerName: manufacturer.name,
        categoryId: category.id,
        status: 'PENDING_REVIEW',
        fingerprint: raw.fingerprint,
        featured: false,
        createdById: creator.id,
        updatedById: creator.id,
      },
      update: {
        name: raw.rawName ?? finalSlug,
        rrpSourceCents,
        rrpSourceCurrency,
        categoryId: category.id,
        manufacturerId: manufacturer.id,
        manufacturerSlug: manufacturer.slug,
        manufacturerName: manufacturer.name,
        fingerprint: raw.fingerprint,
        updatedById: creator.id,
      },
    });

    // EUR vendor offer (the cost the AED sell price is derived from).
    await prisma.vendorOffer.upsert({
      where: { vendorId_vendorUrl: { vendorId: vendor.id, vendorUrl: raw.vendorUrl } },
      create: {
        productId: master.id,
        vendorId: vendor.id,
        vendorSku: raw.vendorSku,
        vendorUrl: raw.vendorUrl,
        priceCents: raw.parsedPriceCents,
        currency: (raw.parsedCurrency ?? 'EUR').toUpperCase(),
        inStock: raw.parsedInStock ?? true,
        lastSeenAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        productId: master.id,
        priceCents: raw.parsedPriceCents,
        currency: (raw.parsedCurrency ?? 'EUR').toUpperCase(),
        inStock: raw.parsedInStock ?? true,
        lastSeenAt: new Date(),
        status: 'ACTIVE',
      },
    });

    // Primary image from the locally-downloaded raw image (offline data: URL).
    const rawImage = raw.images.find((image) => image.storageKey);
    if (rawImage?.storageKey) {
      const existingImage = await prisma.catalogProductImage.findFirst({
        where: { productId: master.id, storageKey: rawImage.storageKey },
        select: { id: true },
      });
      if (!existingImage) {
        await prisma.catalogProductImage.updateMany({
          where: { productId: master.id },
          data: { isPrimary: false },
        });
        await prisma.catalogProductImage.create({
          data: {
            productId: master.id,
            storageKey: rawImage.storageKey,
            mimeType: rawImage.mimeType ?? 'image/png',
            altText: master.name,
            isPrimary: true,
            sortOrder: 0,
            sourceVendorId: vendor.id,
          },
        });
      }
    }

    // Publish + freeze AED sell price (mirrors the admin publish transaction).
    const publishedAt = new Date();
    const snapshot = await prisma.$transaction(async (tx) => {
      const pricing = await buildMasterPricingSnapshotUpdate(tx, master.id, publishedAt);
      await tx.masterProduct.update({
        where: { id: master.id },
        data: {
          ...pricing.data,
          status: 'PUBLISHED',
          publishedAt,
          archivedAt: null,
          updatedById: publisher.id,
        },
      });
      return pricing.snapshot;
    });

    published.push({
      slug: finalSlug,
      masterId: master.id.toString(),
      sourceCostCents: snapshot ? String(snapshot.sourceCostCents) : null,
      sourceCurrency: snapshot?.sourceCurrency ?? null,
      pricedSellCents: snapshot ? String(snapshot.sellPriceCents) : null,
      compareAtCents:
        snapshot && snapshot.compareAtCents !== null ? String(snapshot.compareAtCents) : null,
    });
  }

  // Refresh the matview (drives /api/catalog/products + the site) and project
  // each to Typesense (best-effort — search auth may differ locally).
  await refreshPublicProductsMaterializedViewDebounced();
  const searchResults: Array<{ masterId: string; ok: boolean; error?: string }> = [];
  for (const item of published) {
    try {
      await projectMasterProductToSearch(item.masterId);
      searchResults.push({ masterId: item.masterId, ok: true });
    } catch (error) {
      searchResults.push({
        masterId: item.masterId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Verify the FROZEN values landed in public_products. Proves A1+A3:
  // public_products.sell_price_cents must equal master_products.priced_sell_cents
  // (projection reads the frozen snapshot, NOT live FX) -> no FX drift possible.
  const verification = await prisma.$queryRaw<
    Array<{
      slug: string;
      sell_price_cents: bigint | null;
      compare_at_cents: bigint | null;
      discount_pct: number | null;
      price_currency: string | null;
      priced_sell_cents: bigint | null;
      frozen_matches_projection: boolean | null;
    }>
  >`
    SELECT
      pp.slug::text AS slug,
      pp.sell_price_cents,
      pp.compare_at_cents,
      pp.discount_pct,
      pp.price_currency,
      mp.priced_sell_cents,
      (pp.sell_price_cents IS NOT DISTINCT FROM mp.priced_sell_cents) AS frozen_matches_projection
    FROM public_products pp
    JOIN master_products mp ON mp.public_id = pp.public_id
    WHERE pp.slug LIKE ${SLUG_PREFIX + '%'}
    ORDER BY pp.slug
  `;

  const counts = await prisma.$transaction([
    prisma.masterProduct.count({ where: { slug: { startsWith: SLUG_PREFIX }, status: 'PUBLISHED' } }),
    prisma.vendorRawProduct.count({ where: { ingestionRunId: runId } }),
    prisma.vendorRawImage.count({ where: { rawProduct: { ingestionRunId: runId } } }),
  ]);

  const allFrozenMatch = verification.every((row) => row.frozen_matches_projection === true);
  const report = {
    ok:
      verification.length === published.length &&
      verification.length > 0 &&
      allFrozenMatch,
    note: 'Replace the TODO placeholder products with real mk3.com data before trusting the AED prices.',
    runId: runId.toString(),
    runLabel: `manual:userId=${RUN_LABEL}`,
    fixturePath,
    category: category.slug,
    users: { creator: creator.email, publisher: publisher.email },
    fxRateToAed: { EUR: rates.EUR ?? null, USD: rates.USD ?? null },
    ingestionSummary: ingestion,
    counts: {
      publishedSeedMasters: counts[0],
      rawProductsForRun: counts[1],
      rawImagesForRun: counts[2],
    },
    published,
    publicProducts: verification.map((row) => ({
      slug: row.slug,
      sellPriceCentsAed: row.sell_price_cents ? row.sell_price_cents.toString() : null,
      compareAtCentsAed: row.compare_at_cents ? row.compare_at_cents.toString() : null,
      discountPct: row.discount_pct,
      priceCurrency: row.price_currency,
      pricedSellCentsFrozen: row.priced_sell_cents ? row.priced_sell_cents.toString() : null,
      frozenMatchesProjection: row.frozen_matches_projection,
    })),
    typesense: searchResults,
  };

  console.log(stringify(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
