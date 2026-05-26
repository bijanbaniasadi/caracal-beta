import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';
import type { UserRole } from '@prisma/client';
import { QueueEvents, Worker } from 'bullmq';

import { signAccessToken, type AuthenticatedUser } from '../src/lib/auth.js';
import { getRedisConnectionOptions } from '../src/lib/bin-analysis/queue.js';
import { verifyCatalogRawAsset } from '../src/lib/catalog/object-storage.js';
import {
  enqueueCatalogProjectionJob,
  getCatalogFingerprintQueue,
  getCatalogProjectionQueue,
  catalogQueueNames,
  closeCatalogQueues,
  type CatalogFingerprintJobData,
  type CatalogProjectionJobData,
} from '../src/lib/catalog/queues.js';
import {
  projectMasterProductToSearch,
  refreshPublicProductsMaterializedViewDebounced,
  reindexAllPublicProductsWithAliasSwap,
} from '../src/lib/catalog/projection.js';
import {
  getTypesenseAliasTarget,
  getTypesenseCollectionDocumentCount,
  getTypesenseConfig,
  searchTypesenseProducts,
} from '../src/lib/catalog/typesense.js';
import {
  buildMk3Fingerprint,
  inferMk3Manufacturer,
  inferMk3MpnOrSku,
  inferMk3VariantKey,
  slugifyCatalogValue,
} from '../src/lib/catalog/mk3/fingerprint.js';
import {
  ensureMk3VendorSource,
  runMk3Ingestion,
  summarizeMk3IngestionRun,
} from '../src/lib/catalog/mk3/ingestion.js';
import { processMk3RawProductFingerprint } from '../src/lib/catalog/mk3/matching.js';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

interface ReviewQueueItem {
  id: string;
  rawProductId: string;
  suggestedProductId: string | null;
  suggestedConfidence: number | null;
  resolvedAction: string | null;
  suggestedProduct: { id: string; slug: string; name: string; status: string } | null;
}

interface PublicProduct {
  publicId: string;
  slug: string;
  name: string;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '..');
const repoRoot = resolve(apiRoot, '..', '..');
const fixturePath = resolve(apiRoot, 'fixtures', 'mk3-stage1-sample.json');
const artifactDir = process.env.STAGE1_ARTIFACT_DIR ?? resolve(repoRoot, 'tmp', 'stage1-mk3');
const apiBaseUrl = (process.env.STAGE1_API_BASE_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const expectedRawProducts = 6;

process.env.DATABASE_URL ??= 'postgresql://caracal:caracal_dev@localhost:5432/caracal_dev';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.TYPESENSE_URL ??= 'http://localhost:8108';
process.env.TYPESENSE_API_KEY ??= 'dev-typesense-key';
process.env.TYPESENSE_COLLECTION_ALIAS ??= 'products';
process.env.TYPESENSE_COLLECTION_PREFIX ??= 'products';
process.env.CATALOG_MATVIEW_REFRESH_DEBOUNCE_MS ??= '0';
process.env.CATALOG_RAW_ASSET_DIR ??= resolve(repoRoot, 'tmp', 'stage1-catalog-raw');
process.env.MK3_INGESTION_FIXTURE_PATH = fixturePath;

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

function slugSuffix(runId: string): string {
  return runId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function mk3Fingerprint(input: { name: string; sku: string; brand: string }): string {
  const manufacturer = inferMk3Manufacturer(input.name, input.brand);

  return buildMk3Fingerprint({
    manufacturerSlug: manufacturer.slug,
    manufacturerName: manufacturer.name,
    mpnOrSku: inferMk3MpnOrSku(input.name, input.sku),
    variantKey: inferMk3VariantKey(input.name),
  });
}

async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit & { body?: unknown } = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !body?.success) {
    throw new Error(
      `Admin API ${init.method ?? 'GET'} ${path} failed: HTTP ${response.status} ${stringify(
        body
      )}`
    );
  }

  return body.data as T;
}

async function publicRequest<T>(path: string): Promise<{ data: T; status: number; body: unknown }> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { accept: 'application/json' },
  });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  return {
    data: body?.data as T,
    status: response.status,
    body,
  };
}

async function ensureStageUser(input: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): Promise<AuthenticatedUser> {
  const prisma = getPrismaClient();
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: true,
    },
    update: {
      name: input.name,
      role: input.role,
      isActive: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

async function ensureReferenceData(creatorId: string) {
  const prisma = getPrismaClient();
  const existingCategory = await prisma.catalogCategory.findFirst({
    where: {
      parentId: null,
      slug: 'stage1-validation-tools',
    },
  });
  const category = existingCategory
    ? await prisma.catalogCategory.update({
        where: { id: existingCategory.id },
        data: {
          name: 'Stage 1 Validation Tools',
          description: 'Local-only Stage 1 catalog validation category.',
        },
      })
    : await prisma.catalogCategory.create({
        data: {
          slug: 'stage1-validation-tools',
          name: 'Stage 1 Validation Tools',
          description: 'Local-only Stage 1 catalog validation category.',
        },
      });
  const [alientech, autotuner] = await Promise.all([
    prisma.manufacturer.upsert({
      where: { slug: 'alientech' },
      create: { slug: 'alientech', name: 'Alientech' },
      update: { name: 'Alientech' },
    }),
    prisma.manufacturer.upsert({
      where: { slug: 'autotuner' },
      create: { slug: 'autotuner', name: 'Autotuner' },
      update: { name: 'Autotuner' },
    }),
  ]);

  const exactFingerprint = mk3Fingerprint({
    name: 'Alientech KESS3 Master Kit Stage 1',
    sku: 'STAGE1-KESS3-MASTER',
    brand: 'Alientech',
  });
  const fuzzyFingerprint = mk3Fingerprint({
    name: 'Alientech KESS3 Master Variant Reference Stage 1',
    sku: 'STAGE1-KESS3',
    brand: 'Alientech',
  });

  const [exactMaster, fuzzyMaster] = await Promise.all([
    prisma.masterProduct.upsert({
      where: { slug: 'stage1-mk3-kess3-master-reference' },
      create: {
        slug: 'stage1-mk3-kess3-master-reference',
        sku: 'STAGE1-KESS3-MASTER',
        mpn: 'STAGE1-KESS3-MASTER',
        name: 'Alientech KESS3 Master Kit Stage 1 Reference',
        shortDescription: 'Reference master used for exact MK3 fingerprint validation.',
        longDescriptionMd: 'Reference-only master for Stage 1 exact-match validation.',
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        status: 'DRAFT',
        fingerprint: exactFingerprint,
        featured: false,
        createdById: creatorId,
        updatedById: creatorId,
      },
      update: {
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        status: 'DRAFT',
        fingerprint: exactFingerprint,
        updatedById: creatorId,
      },
    }),
    prisma.masterProduct.upsert({
      where: { slug: 'stage1-mk3-kess3-variant-reference' },
      create: {
        slug: 'stage1-mk3-kess3-variant-reference',
        sku: 'STAGE1-KESS3',
        mpn: 'STAGE1-KESS3',
        name: 'Alientech KESS3 Master Variant Stage 1 Reference',
        shortDescription: 'Reference master used for fuzzy MK3 review validation.',
        longDescriptionMd: 'Reference-only master for Stage 1 fuzzy-match validation.',
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        status: 'DRAFT',
        fingerprint: fuzzyFingerprint,
        featured: false,
        createdById: creatorId,
        updatedById: creatorId,
      },
      update: {
        manufacturerId: alientech.id,
        manufacturerSlug: alientech.slug,
        manufacturerName: alientech.name,
        categoryId: category.id,
        status: 'DRAFT',
        fingerprint: fuzzyFingerprint,
        updatedById: creatorId,
      },
    }),
  ]);

  return { category, alientech, autotuner, exactMaster, fuzzyMaster };
}

async function waitForFingerprintSettlement(runId: bigint): Promise<void> {
  const prisma = getPrismaClient();
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw<Array<{ pending_count: bigint; raw_count: bigint }>>`
      SELECT
        COUNT(*) FILTER (
          WHERE vrp.match_status = 'unmatched' AND rq.id IS NULL
        )::bigint AS pending_count,
        COUNT(*)::bigint AS raw_count
      FROM vendor_raw_products vrp
      LEFT JOIN review_queue rq ON rq.raw_product_id = vrp.id
      WHERE vrp.ingestion_run_id = ${runId}
    `;
    const pending = Number(rows[0]?.pending_count ?? 0n);
    const rawCount = Number(rows[0]?.raw_count ?? 0n);

    if (rawCount >= expectedRawProducts && pending === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Timed out waiting for fingerprint worker to settle Stage 1 raw products.');
}

function productBySku<T extends { vendorSku: string | null; rawName: string | null }>(
  rows: T[],
  sku: string
): T {
  const row = rows.find((item) => item.vendorSku === sku);
  if (!row) throw new Error(`Stage 1 raw product with SKU ${sku} was not found.`);
  return row;
}

function productByUrl<T extends { vendorUrl: string }>(rows: T[], suffix: string): T {
  const row = rows.find((item) => item.vendorUrl.endsWith(suffix));
  if (!row) throw new Error(`Stage 1 raw product with URL suffix ${suffix} was not found.`);
  return row;
}

async function startFingerprintWorker() {
  const connection = getRedisConnectionOptions();
  const results: unknown[] = [];
  const worker = new Worker<CatalogFingerprintJobData>(
    catalogQueueNames.fingerprint,
    async (job) => {
      const result = job.data.rawProductId
        ? await processMk3RawProductFingerprint(job.data.rawProductId)
        : { action: 'fingerprint-placeholder' as const };
      results.push({ jobId: job.id, result });
      return result;
    },
    { connection, concurrency: 1 }
  );
  const events = new QueueEvents(catalogQueueNames.fingerprint, { connection });
  await events.waitUntilReady();

  return { worker, events, results };
}

async function startProjectionWorker() {
  const connection = getRedisConnectionOptions();
  const results: unknown[] = [];
  const worker = new Worker<CatalogProjectionJobData>(
    catalogQueueNames.projection,
    async (job) => {
      let result: unknown;
      if (job.data.type === 'refresh-matview') {
        result = await refreshPublicProductsMaterializedViewDebounced();
      } else if (job.data.type === 'project-product' && job.data.masterProductId) {
        await refreshPublicProductsMaterializedViewDebounced();
        result = await projectMasterProductToSearch(job.data.masterProductId);
      } else if (job.data.type === 'full-reindex') {
        result = await reindexAllPublicProductsWithAliasSwap();
      } else {
        throw new Error(`Unsupported projection job: ${JSON.stringify(job.data)}`);
      }
      results.push({ jobId: job.id, result });
      return result;
    },
    { connection, concurrency: 1 }
  );
  const events = new QueueEvents(catalogQueueNames.projection, { connection });
  await events.waitUntilReady();

  return { worker, events, results };
}

async function enqueueProjectionAndWait(
  data: CatalogProjectionJobData,
  events: QueueEvents
): Promise<unknown> {
  const job = await enqueueCatalogProjectionJob(data);
  return job.waitUntilFinished(events, 120_000);
}

async function validationQueries(input: {
  runId: bigint;
  vendorId: bigint;
  publishedSlug: string;
}) {
  const prisma = getPrismaClient();
  const [
    rawProductRows,
    duplicateRows,
    reviewRows,
    rawImageRows,
    orphanRawImageRows,
    exactRows,
    projectionRows,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM vendor_raw_products
      WHERE ingestion_run_id = ${input.runId} AND vendor_id = ${input.vendorId}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      WITH scoped AS (
        SELECT vendor_url, vendor_sku
        FROM vendor_raw_products
        WHERE ingestion_run_id = ${input.runId} AND vendor_id = ${input.vendorId}
      ),
      duplicate_urls AS (
        SELECT vendor_url FROM scoped GROUP BY vendor_url HAVING COUNT(*) > 1
      ),
      duplicate_skus AS (
        SELECT vendor_sku
        FROM scoped
        WHERE vendor_sku IS NOT NULL
        GROUP BY vendor_sku
        HAVING COUNT(*) > 1
      )
      SELECT (
        (SELECT COUNT(*) FROM duplicate_urls) +
        (SELECT COUNT(*) FROM duplicate_skus)
      )::bigint AS count
    `,
    prisma.$queryRaw<Array<{ total: bigint; unresolved: bigint }>>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE rq.resolved_at IS NULL)::bigint AS unresolved
      FROM review_queue rq
      JOIN vendor_raw_products vrp ON vrp.id = rq.raw_product_id
      WHERE vrp.ingestion_run_id = ${input.runId}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM vendor_raw_images vri
      JOIN vendor_raw_products vrp ON vrp.id = vri.raw_product_id
      WHERE vrp.ingestion_run_id = ${input.runId}
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM vendor_raw_images vri
      LEFT JOIN vendor_raw_products vrp ON vrp.id = vri.raw_product_id
      WHERE vrp.id IS NULL
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM vendor_raw_products
      WHERE ingestion_run_id = ${input.runId}
        AND match_status = 'auto_matched'
        AND match_confidence = 1.00
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM public_products
      WHERE slug = ${input.publishedSlug}::citext
    `,
  ]);

  return {
    mk3RawProductCount: Number(rawProductRows[0]?.count ?? 0n),
    duplicateExternalUrlOrSkuCount: Number(duplicateRows[0]?.count ?? 0n),
    reviewQueueTotalForRun: Number(reviewRows[0]?.total ?? 0n),
    unresolvedReviewQueueForRun: Number(reviewRows[0]?.unresolved ?? 0n),
    rawImageCountForRun: Number(rawImageRows[0]?.count ?? 0n),
    orphanRawImageCountGlobal: Number(orphanRawImageRows[0]?.count ?? 0n),
    exactMatchCountForRun: Number(exactRows[0]?.count ?? 0n),
    publishedProductProjectionCount: Number(projectionRows[0]?.count ?? 0n),
  };
}

async function main(): Promise<void> {
  await mkdir(artifactDir, { recursive: true });

  const prisma = getPrismaClient();
  const fingerprintQueue = getCatalogFingerprintQueue();
  const projectionQueue = getCatalogProjectionQueue();
  const fingerprintBefore = await fingerprintQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
  const projectionBefore = await projectionQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
  const fingerprintRuntime = await startFingerprintWorker();
  const projectionRuntime = await startProjectionWorker();

  try {
    const creator = await ensureStageUser({
      id: 'stage1-catalog-creator',
      email: 'stage1.catalog.creator@caracal.local',
      name: 'Stage 1 Catalog Creator',
      role: 'ADMIN',
    });
    const publisher = await ensureStageUser({
      id: 'stage1-catalog-publisher',
      email: 'stage1.catalog.publisher@caracal.local',
      name: 'Stage 1 Catalog Publisher',
      role: 'ADMIN',
    });
    const creatorToken = signAccessToken(creator).token;
    const publisherToken = signAccessToken(publisher).token;
    const referenceData = await ensureReferenceData(creator.id);
    const vendor = await ensureMk3VendorSource();

    const baselineProjection = await enqueueProjectionAndWait(
      { type: 'full-reindex', reason: 'stage1-baseline-alias' },
      projectionRuntime.events
    );

    const ingestionSummary = await runMk3Ingestion({
      vendorSourceId: vendor.id.toString(),
      requestedBy: creator.id,
      trigger: 'manual',
      maxPages: 2,
    });
    const runId = BigInt(ingestionSummary.ingestionRunId);
    await waitForFingerprintSettlement(runId);

    const rawProducts = await prisma.vendorRawProduct.findMany({
      where: { ingestionRunId: runId },
      include: {
        reviewQueue: true,
        images: true,
      },
      orderBy: { id: 'asc' },
    });

    const exactRaw = productBySku(rawProducts, 'STAGE1-KESS3-MASTER');
    const fuzzyRaw = productBySku(rawProducts, 'STAGE1-KESS3');
    const createRaw = productByUrl(rawProducts, '/products/stage1-autotuner-bench');
    const duplicateRaw = productByUrl(rawProducts, '/products/stage1-autotuner-bench-duplicate');
    const rejectRaw = productBySku(rawProducts, 'STAGE1-MK3-GIFTCARD');
    const archiveRaw = productBySku(rawProducts, 'STAGE1-OBDSTAR-X300');

    if (exactRaw.matchStatus !== 'AUTO_MATCHED') {
      throw new Error(`Expected exact raw product to be AUTO_MATCHED, got ${exactRaw.matchStatus}.`);
    }
    if (!fuzzyRaw.reviewQueue || !createRaw.reviewQueue || !duplicateRaw.reviewQueue) {
      throw new Error('Expected fuzzy/create/duplicate Stage 1 products to enter review_queue.');
    }
    if (!rejectRaw.reviewQueue || !archiveRaw.reviewQueue) {
      throw new Error('Expected reject/archive Stage 1 products to enter review_queue.');
    }

    const approveResult = await apiRequest<ReviewQueueItem>(
      `/api/admin/review-queue/${fuzzyRaw.reviewQueue.id.toString()}/approve-match`,
      creatorToken,
      {
        method: 'POST',
        body: {
          masterProductId: referenceData.fuzzyMaster.id.toString(),
          confidence: 0.8,
          notes: 'Stage 1 validation: approved fuzzy candidate.',
        },
      }
    );

    const createdSlug = `stage1-mk3-autotuner-bench-${slugSuffix(ingestionSummary.ingestionRunId)}`;
    const createResult = await apiRequest<ReviewQueueItem>(
      `/api/admin/review-queue/${createRaw.reviewQueue.id.toString()}/create`,
      creatorToken,
      {
        method: 'POST',
        body: {
          slug: createdSlug,
          sku: `STAGE1-AT-BENCH-${ingestionSummary.ingestionRunId}`,
          mpn: 'STAGE1-AT-BENCH',
          name: 'Autotuner Bench Tool Full Package Stage 1 Curated',
          shortDescription: 'Curated Stage 1 product created from MK3 review queue validation.',
          longDescriptionMd:
            'This local-only Stage 1 product validates the layered lifecycle from MK3 raw staging through review, master curation, projection, search, and frontend rendering.',
          manufacturerId: referenceData.autotuner.id.toString(),
          manufacturerSlug: referenceData.autotuner.slug,
          manufacturerName: referenceData.autotuner.name,
          categoryId: referenceData.category.id.toString(),
          status: 'PENDING_REVIEW',
          featured: true,
          seoTitle: 'Stage 1 Autotuner Bench Tool',
          seoDescription: 'Local Stage 1 validation product.',
          createOffer: true,
          notes: 'Stage 1 validation: create master from MK3 review queue.',
        },
      }
    );
    const createdProductId = createResult.suggestedProduct?.id;
    if (!createdProductId) {
      throw new Error('Review create response did not include a created master product id.');
    }

    const primaryRawImage = createRaw.images.find((image) => image.storageKey);
    if (!primaryRawImage?.storageKey) {
      throw new Error('Create-master raw product does not have a downloaded local image.');
    }

    const imageResult = await apiRequest<{
      id: string;
      storageKey: string;
      isPrimary: boolean;
    }>(`/api/admin/master-products/${createdProductId}/images`, creatorToken, {
      method: 'POST',
      body: {
        storageKey: primaryRawImage.storageKey,
        width: 1,
        height: 1,
        mimeType: primaryRawImage.mimeType ?? 'image/png',
        altText: 'Autotuner Bench Tool Full Package Stage 1',
        isPrimary: true,
        sortOrder: 0,
        sourceVendorId: vendor.id.toString(),
      },
    });

    const offer = await prisma.vendorOffer.findFirst({
      where: {
        productId: BigInt(createdProductId),
        vendorId: vendor.id,
        vendorUrl: createRaw.vendorUrl,
      },
      orderBy: { id: 'desc' },
    });
    if (!offer) throw new Error('Created master product did not receive its vendor offer.');

    const curatedPrice = await apiRequest<{
      id: string;
      productId: string;
      selectedOfferId: string | null;
      priceCents: string;
      currency: string;
    }>(`/api/admin/catalog/curation/pricing/${createdProductId}/curate`, creatorToken, {
      method: 'POST',
      body: {
        offerId: offer.id.toString(),
        priceCents: offer.priceCents?.toString() ?? '349900',
        currency: offer.currency,
        reason: 'Stage 1 validation: select MK3 offer as curated price.',
      },
    });

    const refingerprintResult = await apiRequest<{
      item: ReviewQueueItem;
      fingerprintJobId: string;
    }>(`/api/admin/review-queue/${rejectRaw.reviewQueue.id.toString()}/refingerprint`, creatorToken, {
      method: 'POST',
      body: {
        reason: 'Stage 1 validation: rerun fingerprint before rejection.',
      },
    });
    const refingerprintJob = await fingerprintQueue.getJob(refingerprintResult.fingerprintJobId);
    if (refingerprintJob) {
      await refingerprintJob.waitUntilFinished(fingerprintRuntime.events, 60_000);
    }

    const mergeResult = await apiRequest<ReviewQueueItem>(
      `/api/admin/review-queue/${duplicateRaw.reviewQueue.id.toString()}/merge-duplicate`,
      creatorToken,
      {
        method: 'POST',
        body: {
          canonicalRawProductId: createRaw.id.toString(),
          reason: 'Stage 1 validation: duplicate MK3 raw listing merged into canonical raw row.',
        },
      }
    );
    const rejectResult = await apiRequest<ReviewQueueItem>(
      `/api/admin/review-queue/${rejectRaw.reviewQueue.id.toString()}/reject`,
      creatorToken,
      {
        method: 'POST',
        body: {
          reason: 'Stage 1 validation: gift card is not a catalog product.',
        },
      }
    );
    const archiveResult = await apiRequest<ReviewQueueItem>(
      `/api/admin/review-queue/${archiveRaw.reviewQueue.id.toString()}/archive`,
      creatorToken,
      {
        method: 'POST',
        body: {
          reason: 'Stage 1 validation: promo bundle archived from staged intake.',
        },
      }
    );

    const publishedProduct = await apiRequest<PublicProduct>(
      `/api/admin/master-products/${createdProductId}/publish`,
      publisherToken,
      {
        method: 'POST',
        body: {
          reason: 'Stage 1 validation: publish curated MK3 product for projection lifecycle.',
        },
      }
    );

    const finalProjection = await enqueueProjectionAndWait(
      { type: 'full-reindex', reason: 'stage1-final-published-product' },
      projectionRuntime.events
    );

    const apiProductList = await publicRequest<PublicProduct[]>(
      `/api/catalog/products?limit=12&category=${slugifyCatalogValue(referenceData.category.slug)}`
    );
    const apiProductDetail = await publicRequest<PublicProduct>(
      `/api/catalog/products/${publishedProduct.slug}`
    );
    const apiSearch = await publicRequest<PublicProduct[]>(
      `/api/catalog/search?q=Autotuner&limit=12`
    );

    const typesenseConfig = getTypesenseConfig();
    const aliasTarget = await getTypesenseAliasTarget(typesenseConfig.collectionAlias, typesenseConfig);
    const indexedCount = aliasTarget
      ? await getTypesenseCollectionDocumentCount(typesenseConfig.collectionAlias, typesenseConfig)
      : 0;
    const directSearch = await searchTypesenseProducts(
      { q: 'Autotuner', page: 1, perPage: 12 },
      typesenseConfig
    );
    const validation = await validationQueries({
      runId,
      vendorId: vendor.id,
      publishedSlug: publishedProduct.slug,
    });
    const finalSummary = await summarizeMk3IngestionRun(ingestionSummary.ingestionRunId);
    const rawImageVerification = await Promise.all(
      rawProducts
        .flatMap((raw) => raw.images)
        .filter((image): image is typeof image & { storageKey: string } => Boolean(image.storageKey))
        .map(async (image) => ({
          rawImageId: image.id.toString(),
          originalUrl: image.originalUrl.slice(0, 48),
          contentHash: image.contentHash,
          ...(await verifyCatalogRawAsset(image.storageKey)),
        }))
    );
    const fingerprintAfter = await fingerprintQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    const projectionAfter = await projectionQueue.getJobCounts('waiting', 'active', 'completed', 'failed');

    const report = {
      ok:
        validation.mk3RawProductCount === expectedRawProducts &&
        validation.exactMatchCountForRun >= 1 &&
        validation.reviewQueueTotalForRun >= 5 &&
        validation.unresolvedReviewQueueForRun === 0 &&
        validation.rawImageCountForRun >= expectedRawProducts &&
        validation.orphanRawImageCountGlobal === 0 &&
        validation.publishedProductProjectionCount === 1 &&
        indexedCount >= validation.publishedProductProjectionCount &&
        directSearch.hits.some((hit) => hit.slug === publishedProduct.slug) &&
        apiProductList.status === 200 &&
        apiProductDetail.status === 200 &&
        apiSearch.status === 200 &&
        Array.isArray(apiSearch.data) &&
        apiSearch.data.some((item) => item.slug === publishedProduct.slug),
      fixture: {
        path: fixturePath,
        maxProducts: expectedRawProducts,
        scope: 'MK3 vendor source, /products/stage1-* URLs only',
      },
      users: {
        creator: creator.email,
        publisher: publisher.email,
      },
      ingestion: finalSummary,
      fingerprint: {
        exactRawProductId: exactRaw.id.toString(),
        exactMasterProductId: exactRaw.matchedProductId?.toString() ?? null,
        fuzzyRawProductId: fuzzyRaw.id.toString(),
        fuzzySuggestedProductId: fuzzyRaw.reviewQueue.suggestedProductId?.toString() ?? null,
        deterministicFingerprints: rawProducts.map((raw) => ({
          rawProductId: raw.id.toString(),
          sku: raw.vendorSku,
          fingerprint: raw.fingerprint,
          matchStatus: raw.matchStatus,
          matchConfidence: raw.matchConfidence?.toString() ?? null,
        })),
      },
      adminWorkflow: {
        approvedExistingMatch: approveResult,
        createdMasterProduct: {
          reviewQueueItem: createResult,
          productId: createdProductId,
          slug: publishedProduct.slug,
          image: imageResult,
        },
        mergedDuplicate: mergeResult,
        rejected: rejectResult,
        archived: archiveResult,
        curatedPrice,
        publishedProduct,
      },
      projection: {
        baselineProjection,
        finalProjection,
        publicProductsCountForPublishedProduct: validation.publishedProductProjectionCount,
      },
      search: {
        alias: typesenseConfig.collectionAlias,
        aliasTarget,
        indexedCount,
        directSearchFound: directSearch.found,
        directSearchSlugs: directSearch.hits.map((hit) => hit.slug),
        apiSearchStatus: apiSearch.status,
        apiSearchSlugs: Array.isArray(apiSearch.data) ? apiSearch.data.map((item) => item.slug) : [],
      },
      frontendApiLifecycle: {
        productsStatus: apiProductList.status,
        productDetailStatus: apiProductDetail.status,
        searchStatus: apiSearch.status,
      },
      sqlValidation: validation,
      images: {
        rawImageVerification,
      },
      queues: {
        fingerprint: {
          before: fingerprintBefore,
          after: fingerprintAfter,
          workerResults: fingerprintRuntime.results,
        },
        projection: {
          before: projectionBefore,
          after: projectionAfter,
          workerResults: projectionRuntime.results,
        },
      },
    };

    const reportPath = resolve(artifactDir, `stage1-mk3-validation-${ingestionSummary.ingestionRunId}.json`);
    await writeFile(reportPath, stringify(report), 'utf8');
    console.log(stringify({ reportPath, ...report }));

    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.allSettled([
      fingerprintRuntime.worker.close(),
      projectionRuntime.worker.close(),
      fingerprintRuntime.events.close(),
      projectionRuntime.events.close(),
      closeCatalogQueues(),
    ]);
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
