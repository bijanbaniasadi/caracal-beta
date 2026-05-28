/**
 * M2a — Manufacturer-content enrichment for the imported 29 (AutoTuner + Alientech first).
 *
 * For each entry in the mapping table below:
 *   1. Look up the existing master_product by slug.
 *   2. Call the appropriate manufacturer fetcher (autotuner.com Shopify JSON
 *      or alientech-tools.com WordPress HTML).
 *   3. Download every returned image, upload via CatalogImageStorage (VPS /media
 *      for M2a; R2 swap is one file change later).
 *   4. Replace the master's images, refresh description + name + RRP source.
 *   5. Apply A3.1 freeze for compare-at — but PRESERVE the legacy AED sell price.
 *      Compute the snapshot only to extract the AED compare-at; leave priced_sell_cents alone.
 *   6. Refresh matview + project to Typesense.
 *
 * Idempotent: re-running replaces images (new files written, old kept on disk
 * for now — purge is a separate cleanup). Master fields are overwritten with
 * the latest manufacturer content.
 *
 * Run inside the prod api container:
 *   docker compose -f docker-compose.prod.yml --env-file .env.production \
 *     exec api sh -c 'cd /app && pnpm --filter @caracal/api exec tsx scripts/enrich-imported-products.ts'
 */
import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

import {
  defaultCatalogImageStorage,
  extensionFromContentType,
} from '../src/lib/catalog/image-storage.js';
import { getManufacturerFetcher } from '../src/lib/catalog/manufacturers/registry.js';
import type {
  ManufacturerProductContent,
} from '../src/lib/catalog/manufacturers/types.js';
import { fetchBinary } from '../src/lib/catalog/manufacturers/web-transport.js';
import {
  buildMasterPricingSnapshotUpdate,
} from '../src/lib/catalog/pricing-snapshot.js';
import {
  projectMasterProductToSearch,
  refreshPublicProductsMaterializedViewDebounced,
} from '../src/lib/catalog/projection.js';

process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ??= '0';

// --------------------------------------------------------------------------
// Routing: our slug -> manufacturer page + optional variant selector
// --------------------------------------------------------------------------
interface EnrichmentTarget {
  ourSlug: string; // master.slug
  brandSlug: 'autotuner' | 'alientech';
  manufacturerHandle: string;
  variantTitle?: string;
  /** Whether to take the variant price as RRP (only when it really is the
   *  manufacturer's published retail price, not a dealer/intermediate price). */
  useVariantPriceAsRrp: boolean;
}

const TARGETS: EnrichmentTarget[] = [
  // AutoTuner — Shopify, real public retail prices in EUR.
  { ourSlug: 'autotuner-tool-device-master-version', brandSlug: 'autotuner', manufacturerHandle: 'autotuner-tool', variantTitle: 'Master', useVariantPriceAsRrp: true },
  { ourSlug: 'autotuner-tool-device-slave-version',  brandSlug: 'autotuner', manufacturerHandle: 'autotuner-tool', variantTitle: 'Slave',  useVariantPriceAsRrp: true },
  { ourSlug: 'autotuner-one-multi-brand-obd-ii-personal-flasher', brandSlug: 'autotuner', manufacturerHandle: 'autotuner-one', useVariantPriceAsRrp: true },
  // Alientech — dealer-only, no public prices; description + images only.
  { ourSlug: 'alientech-kessv3-ecu-and-tcu-programmer-obd-bench-boot',           brandSlug: 'alientech', manufacturerHandle: '/kess3/', variantTitle: 'KESS V3', useVariantPriceAsRrp: false },
  { ourSlug: 'alientech-kess3-slave-cars-agriculture-truck-bikes-marine-ob',      brandSlug: 'alientech', manufacturerHandle: '/kess3/', variantTitle: 'KESS3 Slave',  useVariantPriceAsRrp: false },
  { ourSlug: 'alientech-kess3-master-cars-agriculture-truck-bikes-marine-o',      brandSlug: 'alientech', manufacturerHandle: '/kess3/', variantTitle: 'KESS3 Master', useVariantPriceAsRrp: false },
];

function stringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
}

interface UploadedImage {
  publicUrl: string;
  altText: string | null;
  isPrimary: boolean;
}

async function downloadAndUploadImages(
  content: ManufacturerProductContent,
  brandSlug: string,
  ourSku: string,
  storage: ReturnType<typeof defaultCatalogImageStorage>
): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  for (let index = 0; index < content.images.length; index += 1) {
    const image = content.images[index];
    const fetched = await fetchBinary(image.sourceUrl);
    if (!fetched.ok || !fetched.bytes) {
      // Skip unreachable images but don't fail the whole enrichment.
      continue;
    }
    const extension = extensionFromContentType(fetched.contentType ?? '');
    const result = await storage.upload({
      bytes: fetched.bytes,
      key: `products/${brandSlug}/${ourSku.toLowerCase()}-${index}`,
      extension,
      contentType: fetched.contentType,
    });
    uploaded.push({
      publicUrl: result.publicUrl,
      altText: image.altText ?? null,
      isPrimary: image.isPrimary || uploaded.length === 0,
    });
  }
  // Ensure exactly one primary image (the first uploaded).
  for (let i = 0; i < uploaded.length; i += 1) uploaded[i].isPrimary = i === 0;
  return uploaded;
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  const storage = defaultCatalogImageStorage();

  const reports: Array<{
    ourSlug: string;
    brand: string;
    manufacturerUrl: string;
    confidence: number;
    canonicalName: string;
    descriptionChars: number;
    imagesUploaded: number;
    primaryImageUrl: string | null;
    rrp: { cents: string; currency: string } | null;
    snapshotCompareAtCents: string | null;
    snapshotDiscountPct: number | null;
    skipped: string | null;
    error: string | null;
  }> = [];

  for (const target of TARGETS) {
    try {
      const master = await prisma.masterProduct.findUnique({
        where: { slug: target.ourSlug },
      });
      if (!master) {
        reports.push({
          ourSlug: target.ourSlug,
          brand: target.brandSlug,
          manufacturerUrl: '',
          confidence: 0,
          canonicalName: '',
          descriptionChars: 0,
          imagesUploaded: 0,
          primaryImageUrl: null,
          rrp: null,
          snapshotCompareAtCents: null,
          snapshotDiscountPct: null,
          skipped: 'master not found',
          error: null,
        });
        continue;
      }

      const fetcher = getManufacturerFetcher(target.brandSlug);
      if (!fetcher) throw new Error(`No fetcher registered for brand '${target.brandSlug}'`);

      const content = await fetcher.fetch({
        handle: target.manufacturerHandle,
        variantTitle: target.variantTitle,
        ourSku: master.sku ?? undefined,
      });

      const ourSku = master.sku ?? master.id.toString();
      const uploadedImages = await downloadAndUploadImages(
        content,
        target.brandSlug,
        ourSku,
        storage
      );

      // Decide whether to set rrpSource from the fetched content.
      const rrpSourceCents = target.useVariantPriceAsRrp && content.rrp ? content.rrp.cents : null;
      const rrpSourceCurrency = target.useVariantPriceAsRrp && content.rrp ? content.rrp.currency : null;

      // Update master with enriched content. Use the manufacturer canonical
      // name + description, set RRP source, keep slug/sku/category/pricing.
      // longDescriptionMd uses manufacturer body; fall back to existing if empty.
      const newDescription = content.description.trim() || master.longDescriptionMd || '';
      const newShort = newDescription.slice(0, 200);

      // Name preservation rule:
      //   - If we passed a variantTitle to the fetcher and the fetched name
      //     doesn't reference it, the manufacturer page is a single shared
      //     page for all variants (Alientech /kess3/). Keep our legacy name
      //     so the three KESS3 variants don't collapse to identical names.
      //   - Otherwise (AutoTuner master/slave pages, fetcher returned a
      //     variant-specific name), trust the manufacturer canonical.
      const variantHint = target.variantTitle?.trim().toLowerCase() ?? '';
      const fetchedNameLower = content.canonicalName.toLowerCase();
      const shouldUseFetchedName =
        !variantHint || fetchedNameLower.includes(variantHint);
      const newName = shouldUseFetchedName ? content.canonicalName : master.name;

      await prisma.masterProduct.update({
        where: { id: master.id },
        data: {
          name: newName,
          shortDescription: newShort,
          longDescriptionMd: newDescription,
          rrpSourceCents,
          rrpSourceCurrency,
          updatedById: master.updatedById,
        },
      });

      // Replace primary image. We keep any old non-primary images for now and
      // just unset their primary flag, then attach all new uploads.
      if (uploadedImages.length > 0) {
        await prisma.catalogProductImage.updateMany({
          where: { productId: master.id },
          data: { isPrimary: false },
        });
        for (let index = 0; index < uploadedImages.length; index += 1) {
          const image = uploadedImages[index];
          const existing = await prisma.catalogProductImage.findFirst({
            where: { productId: master.id, storageKey: image.publicUrl },
            select: { id: true },
          });
          if (existing) {
            await prisma.catalogProductImage.update({
              where: { id: existing.id },
              data: {
                isPrimary: image.isPrimary,
                sortOrder: index,
                altText: image.altText,
              },
            });
          } else {
            await prisma.catalogProductImage.create({
              data: {
                productId: master.id,
                storageKey: image.publicUrl,
                mimeType: 'image/jpeg',
                altText: image.altText,
                isPrimary: image.isPrimary,
                sortOrder: index,
              },
            });
          }
        }
      }

      // Apply A3.1 freeze for compare-at WITHOUT touching priced_sell_cents.
      // We call the snapshot builder to compute the AED compare-at given the
      // new RRP source, then apply only the compare_at_* fields. The legacy
      // sell price stays exactly as it is (frozen by the M1 import).
      const snapshotResult = await prisma.$transaction((tx) =>
        buildMasterPricingSnapshotUpdate(tx, master.id, new Date())
      );
      const snapCompareAt = snapshotResult.snapshot?.compareAtCents ?? null;
      const snapCurrency = snapshotResult.snapshot?.compareAtCurrency ?? null;

      await prisma.masterProduct.update({
        where: { id: master.id },
        data: {
          compareAtCents: snapCompareAt !== null ? BigInt(snapCompareAt) : null,
          compareAtCurrency: snapCurrency,
        },
      });

      // Pull updated row + sell price for discount-pct preview in the report.
      const updated = await prisma.masterProduct.findUnique({
        where: { id: master.id },
        select: { pricedSellCents: true, compareAtCents: true },
      });
      const sell = updated?.pricedSellCents ? Number(updated.pricedSellCents) : null;
      const compare = updated?.compareAtCents ? Number(updated.compareAtCents) : null;
      const discountPct =
        sell !== null && compare !== null && compare > sell
          ? Math.floor(((compare - sell) * 100) / compare)
          : null;

      reports.push({
        ourSlug: target.ourSlug,
        brand: target.brandSlug,
        manufacturerUrl: content.sourceUrl,
        confidence: content.confidence,
        canonicalName: content.canonicalName,
        descriptionChars: newDescription.length,
        imagesUploaded: uploadedImages.length,
        primaryImageUrl: uploadedImages[0]?.publicUrl ?? null,
        rrp: content.rrp
          ? { cents: content.rrp.cents.toString(), currency: content.rrp.currency }
          : null,
        snapshotCompareAtCents: compare?.toString() ?? null,
        snapshotDiscountPct: discountPct,
        skipped: null,
        error: null,
      });
    } catch (error) {
      reports.push({
        ourSlug: target.ourSlug,
        brand: target.brandSlug,
        manufacturerUrl: '',
        confidence: 0,
        canonicalName: '',
        descriptionChars: 0,
        imagesUploaded: 0,
        primaryImageUrl: null,
        rrp: null,
        snapshotCompareAtCents: null,
        snapshotDiscountPct: null,
        skipped: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Refresh matview + project all enriched products to Typesense.
  await refreshPublicProductsMaterializedViewDebounced();
  const succeededSlugs = reports.filter((r) => !r.error && !r.skipped).map((r) => r.ourSlug);
  for (const slug of succeededSlugs) {
    const row = await prisma.masterProduct.findUnique({ where: { slug }, select: { id: true } });
    if (row) await projectMasterProductToSearch(row.id.toString()).catch(() => undefined);
  }

  const summary = {
    ok: reports.every((r) => !r.error && !r.skipped),
    storageBackend: storage.backend,
    counts: {
      total: reports.length,
      enriched: reports.filter((r) => !r.error && !r.skipped).length,
      failed: reports.filter((r) => r.error).length,
      skipped: reports.filter((r) => r.skipped).length,
    },
    products: reports,
  };
  console.log(stringify(summary));
  if (!summary.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
