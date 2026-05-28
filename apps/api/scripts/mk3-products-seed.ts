/**
 * MK3 real-product manual entry (production-capable).
 *
 * Publishes a small set of REAL, hand-entered mk3 products straight through the
 * curation + publish path so the live catalog has genuine listings with honest
 * AED pricing and discounts. Unlike the validation seed, these are real products
 * (real slugs, real category, no purge tagging) and are meant to stay.
 *
 *   real product data  ->  master_products + EUR vendor_offers
 *                       ->  primary image = self-hosted https://<host>/media/<file>
 *                       ->  publish (A3 freezes AED sell price, A3.1 freezes AED compare-at)
 *                       ->  public_products matview + Typesense
 *
 * Images are NOT downloaded here — they are served by nginx from the VPS media
 * volume (host: /var/www/caracal-media). Put each product photo there first and
 * reference it by filename below; the storage key becomes PUBLIC_SITE_URL/media/<file>,
 * which the public catalog serves directly (the projection passes http(s) keys through).
 *
 * Run INSIDE the production api container (it ships tsx + source):
 *   docker compose -f docker-compose.prod.yml --env-file .env.production \
 *     exec api sh -c 'cd /app && pnpm --filter @caracal/api exec tsx scripts/mk3-products-seed.ts'
 *
 * Idempotent: re-running upserts by slug and re-publishes (re-freezes price at
 * current FX). Safe to run again after editing the product list.
 */
import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

import {
  buildMk3Fingerprint,
  inferMk3Manufacturer,
  inferMk3MpnOrSku,
  inferMk3VariantKey,
} from '../src/lib/catalog/mk3/fingerprint.js';
import { buildMasterPricingSnapshotUpdate } from '../src/lib/catalog/pricing-snapshot.js';
import {
  projectMasterProductToSearch,
  refreshPublicProductsMaterializedViewDebounced,
} from '../src/lib/catalog/projection.js';
import { ensureMk3VendorSource } from '../src/lib/catalog/mk3/ingestion.js';
import { ensureStageUser } from './seed-mk3-stage1-references.js';

// --------------------------------------------------------------------------
// REAL PRODUCTS — replace these with genuine mk3 listings copied by hand.
// For each one:
//   - download the product photo and place it at /var/www/caracal-media/<imageFile> on the VPS
//   - copy the real EUR price and (if shown) the real RRP / list price
//   - never invent an RRP; for a discount to show, RRP must exceed price x 1.15 in AED
// --------------------------------------------------------------------------
type SupportedCurrency = 'USD' | 'EUR' | 'GBP';

interface RealProductInput {
  slug: string; // real, permanent kebab slug
  name: string;
  sku: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  shortDescription: string;
  longDescriptionMd: string;
  /** Vendor offer cost as it appears on the mk3 page (no symbol). e.g. "5697.67" */
  price: string;
  /** Currency the mk3 page displays for that price. */
  currency: SupportedCurrency;
  /** Manufacturer RRP / list price (vendor currency), or null when none is shown.
   *  A3.1 freezes this to AED at publish — but only when it beats the AED sell price. */
  rrp: string | null;
  rrpCurrency: SupportedCurrency | null;
  imageFile: string; // filename placed in /var/www/caracal-media/
  vendorUrl: string; // the real mk3 product page URL (provenance + offer key)
  inStock: boolean;
}

const PRODUCTS: RealProductInput[] = [
  {
    slug: 'autotuner-tool-master',
    name: 'AutoTuner Tool Master Version',
    sku: 'MKON332',
    brand: 'AutoTuner',
    categorySlug: 'ecu-programmers',
    categoryName: 'ECU Programmers',
    shortDescription:
      'AutoTuner Master — professional OBD, Bench, Boot, BDM and JTAG ECU programming tool with full unlocked access for tuning workshops.',
    longDescriptionMd:
      [
        'AutoTuner Tool Master Version is the unlocked, full-feature variant of AutoTuner\'s professional ECU programming hardware. Used by tuning workshops across petrol and diesel platforms for OBD, Bench, Boot, BDM and JTAG access.',
        '',
        '**What\'s in the box**',
        '',
        '- AutoTuner Tool (Master, full unlock)',
        '- OBD cable',
        '- Boot cable',
        '- Universal cable + Universal box',
        '- Probe Positioner + test probe and cable',
        '- Probe',
        '- BGA MCU Hook',
        '- USB key with drivers',
        '- Power Adapter',
        '- Carrying case',
        '',
        '**Why Master**',
        '',
        'The Master variant carries its own license and is not tied to a parent device — required for independent workshops and primary tool setups. The Slave variant must be linked to an existing Master at checkout.',
        '',
        '**Sourcing**',
        '',
        'UAE stock and direct sourcing through Caracal Tech Motors, Deira, Dubai. Card, invoice and bank-transfer checkout supported. Ask before purchase if you need protocol, ECU or vehicle coverage confirmation.',
      ].join('\n'),
    price: '4000.00', // real dealer cost from mk3, not the public list price
    currency: 'EUR',
    rrp: '4900.00', // manufacturer official retail (autotuner.com)
    rrpCurrency: 'EUR',
    imageFile: 'autotuner-tool-master.jpg',
    vendorUrl: 'https://www.mk3.com/en/autotuner-tool-device-master-version',
    inStock: true,
  },
];

const RUN_LABEL = 'mk3-manual-entry';

process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ??= '0';

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

function priceStringToCents(value: string, label: string): bigint {
  const normalized = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`Invalid ${label} price "${value}".`);
  }
  return BigInt(Math.round(normalized * 100));
}

async function upsertCategory(slug: string, name: string) {
  const prisma = getPrismaClient();
  const existing = await prisma.catalogCategory.findFirst({
    where: { parentId: null, slug },
  });
  if (existing) return existing;
  return prisma.catalogCategory.create({ data: { slug, name } });
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  const publicSiteUrl = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  if (!publicSiteUrl) {
    throw new Error('PUBLIC_SITE_URL must be set (used to build /media/ image URLs).');
  }

  const todo = PRODUCTS.filter(
    (product) => product.slug.startsWith('TODO') || product.sku.startsWith('TODO')
  );
  if (todo.length > 0) {
    throw new Error(
      `Refusing to run: ${todo.length} placeholder product(s) still present. Replace the TODO entries with real mk3 data first.`
    );
  }
  for (const product of PRODUCTS) {
    if (product.rrp !== null && product.rrpCurrency === null) {
      throw new Error(
        `Product ${product.slug}: rrp is set but rrpCurrency is missing — set both or neither.`
      );
    }
  }

  const creator = await ensureStageUser({
    id: 'caracal-catalog-creator',
    email: 'catalog.creator@caracal.local',
    name: 'Catalog Creator',
    role: 'ADMIN',
  });
  const publisher = await ensureStageUser({
    id: 'caracal-catalog-publisher',
    email: 'catalog.publisher@caracal.local',
    name: 'Catalog Publisher',
    role: 'ADMIN',
  });
  const vendor = await ensureMk3VendorSource();

  const published: Array<{
    slug: string;
    masterId: string;
    imageUrl: string;
    sourceCostCents: string | null;
    sourceCurrency: string | null;
    pricedSellCents: string | null;
    compareAtCents: string | null;
  }> = [];

  for (const product of PRODUCTS) {
    const manufacturer = inferMk3Manufacturer(product.name, product.brand);
    const mpnOrSku = inferMk3MpnOrSku(product.name, product.sku);
    const variantKey = inferMk3VariantKey(product.name);
    const fingerprint = buildMk3Fingerprint({
      manufacturerSlug: manufacturer.slug,
      manufacturerName: manufacturer.name,
      mpnOrSku,
      variantKey,
    });

    const manufacturerRow = await prisma.manufacturer.upsert({
      where: { slug: manufacturer.slug },
      create: { slug: manufacturer.slug, name: manufacturer.name },
      update: { name: manufacturer.name },
    });
    const category = await upsertCategory(product.categorySlug, product.categoryName);

    const rrpSourceCents = product.rrp ? priceStringToCents(product.rrp, 'RRP') : null;
    const rrpSourceCurrency = product.rrp ? product.rrpCurrency : null;
    const imageUrl = `${publicSiteUrl}/media/${product.imageFile}`;

    const master = await prisma.masterProduct.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        sku: product.sku,
        mpn: product.sku,
        name: product.name,
        shortDescription: product.shortDescription,
        longDescriptionMd: product.longDescriptionMd,
        rrpSourceCents,
        rrpSourceCurrency,
        manufacturerId: manufacturerRow.id,
        manufacturerSlug: manufacturerRow.slug,
        manufacturerName: manufacturerRow.name,
        categoryId: category.id,
        status: 'PENDING_REVIEW',
        fingerprint,
        featured: false,
        createdById: creator.id,
        updatedById: creator.id,
      },
      update: {
        name: product.name,
        sku: product.sku,
        mpn: product.sku,
        shortDescription: product.shortDescription,
        longDescriptionMd: product.longDescriptionMd,
        rrpSourceCents,
        rrpSourceCurrency,
        manufacturerId: manufacturerRow.id,
        manufacturerSlug: manufacturerRow.slug,
        manufacturerName: manufacturerRow.name,
        categoryId: category.id,
        fingerprint,
        updatedById: creator.id,
      },
    });

    const offerCents = priceStringToCents(product.price, 'offer');
    await prisma.vendorOffer.upsert({
      where: { vendorId_vendorUrl: { vendorId: vendor.id, vendorUrl: product.vendorUrl } },
      create: {
        productId: master.id,
        vendorId: vendor.id,
        vendorSku: product.sku,
        vendorUrl: product.vendorUrl,
        priceCents: offerCents,
        currency: product.currency,
        inStock: product.inStock,
        lastSeenAt: new Date(),
        status: 'ACTIVE',
      },
      update: {
        productId: master.id,
        priceCents: offerCents,
        currency: product.currency,
        inStock: product.inStock,
        lastSeenAt: new Date(),
        status: 'ACTIVE',
      },
    });

    // Primary image = self-hosted public URL (served by nginx /media/).
    const existingImage = await prisma.catalogProductImage.findFirst({
      where: { productId: master.id, storageKey: imageUrl },
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
          storageKey: imageUrl,
          mimeType: 'image/jpeg',
          altText: product.name,
          isPrimary: true,
          sortOrder: 0,
          sourceVendorId: vendor.id,
        },
      });
    }

    // Publish + freeze AED sell price and AED compare-at (A3 + A3.1).
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
      slug: product.slug,
      masterId: master.id.toString(),
      imageUrl,
      sourceCostCents: snapshot ? String(snapshot.sourceCostCents) : null,
      sourceCurrency: snapshot?.sourceCurrency ?? null,
      pricedSellCents: snapshot ? String(snapshot.sellPriceCents) : null,
      compareAtCents:
        snapshot && snapshot.compareAtCents !== null ? String(snapshot.compareAtCents) : null,
    });
  }

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

  const slugs = published.map((item) => item.slug);
  const verification = await prisma.$queryRaw<
    Array<{
      slug: string;
      sell_price_cents: bigint | null;
      compare_at_cents: bigint | null;
      discount_pct: number | null;
      primary_image: unknown;
    }>
  >`
    SELECT pp.slug::text AS slug, pp.sell_price_cents, pp.compare_at_cents, pp.discount_pct,
           pp.primary_image
    FROM public_products pp
    WHERE pp.slug = ANY(${slugs}::citext[])
    ORDER BY pp.slug
  `;

  const report = {
    ok: verification.length === published.length && verification.length > 0,
    runLabel: RUN_LABEL,
    publicSiteUrl,
    users: { creator: creator.email, publisher: publisher.email },
    counts: { requested: PRODUCTS.length, published: published.length },
    published,
    publicProducts: verification.map((row) => ({
      slug: row.slug,
      sellPriceCentsAed: row.sell_price_cents ? row.sell_price_cents.toString() : null,
      compareAtCentsAed: row.compare_at_cents ? row.compare_at_cents.toString() : null,
      discountPct: row.discount_pct,
      hasPrimaryImage: Boolean(row.primary_image),
    })),
    typesense: searchResults,
    reminder:
      'Confirm each https://<host>/media/<file> image loads in a browser, and that the products render on the site.',
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
