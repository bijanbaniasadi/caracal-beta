/**
 * Purge everything created by mk3-validation-seed.ts.
 *
 * Removes, in FK-safe order:
 *   1. master_products with slug prefix `mk3-validation-seed-`
 *      (cascade deletes their vendor_offers, product_images, curated price,
 *       specs, tags, compatibility)
 *   2. vendor_raw_products for ingestion runs tagged `mk3-validation-seed`
 *      (cascade deletes their vendor_raw_images and review_queue rows)
 *   3. the tagged ingestion_runs themselves
 * Then refreshes the public_products matview so the site/browse drops them, and
 * best-effort re-syncs Typesense.
 *
 * Run (full local Docker stack up):
 *   pnpm --filter @caracal/api exec tsx scripts/mk3-validation-seed-purge.ts
 */
import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

import {
  reindexAllPublicProductsWithAliasSwap,
  refreshPublicProductsMaterializedViewDebounced,
} from '../src/lib/catalog/projection.js';

const SLUG_PREFIX = 'mk3-validation-seed-';
const RUN_LABEL = 'mk3-validation-seed';

process.env.DATABASE_URL ??= 'postgresql://caracal:caracal_dev@localhost:5432/caracal_dev';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.TYPESENSE_URL ??= 'http://localhost:8108';
process.env.TYPESENSE_API_KEY ??= 'dev-typesense-key';
process.env.TYPESENSE_COLLECTION_ALIAS ??= 'products';
process.env.TYPESENSE_COLLECTION_PREFIX ??= 'products';
process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ??= '0';

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();

  const seedMasters = await prisma.masterProduct.findMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
    select: { id: true, slug: true },
  });
  const seedRuns = await prisma.ingestionRun.findMany({
    where: {
      vendor: { slug: 'mk3' },
      triggeredBy: { contains: RUN_LABEL },
    },
    select: { id: true },
  });
  const runIds = seedRuns.map((run) => run.id);

  // 1) masters (cascades offers/images/curated/specs/tags/compatibility)
  const deletedMasters = await prisma.masterProduct.deleteMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
  });

  // 2) raw products for tagged runs (cascades raw images + review queue)
  const deletedRaw =
    runIds.length > 0
      ? await prisma.vendorRawProduct.deleteMany({ where: { ingestionRunId: { in: runIds } } })
      : { count: 0 };

  // 3) the tagged ingestion runs
  const deletedRuns =
    runIds.length > 0
      ? await prisma.ingestionRun.deleteMany({ where: { id: { in: runIds } } })
      : { count: 0 };

  // Drop them from browse, and best-effort from search.
  await refreshPublicProductsMaterializedViewDebounced();
  let searchResynced = false;
  let searchError: string | null = null;
  try {
    await reindexAllPublicProductsWithAliasSwap();
    searchResynced = true;
  } catch (error) {
    searchError = error instanceof Error ? error.message : String(error);
  }

  console.log(
    stringify({
      ok: true,
      removedMasters: deletedMasters.count,
      removedMasterSlugs: seedMasters.map((master) => master.slug),
      removedRawProducts: deletedRaw.count,
      removedIngestionRuns: deletedRuns.count,
      searchResynced,
      searchError,
      note: 'Validation users, vendor source, and the validation category are left in place (harmless, reused on re-seed).',
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient();
  });
