import { getPrismaClient } from '@caracal/db';
import type { Prisma } from '@prisma/client';

import {
  getTypesenseAliasTarget,
  getTypesenseCollectionDocumentCount,
  getTypesenseConfig,
} from './typesense.js';
import { getCatalogQueues } from './queues.js';
import { verifyCatalogRawAsset } from './object-storage.js';

const RECENT_REVIEW_LIMIT = 10;
const REPORT_ROW_LIMIT = 50;

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value ? value.toNumber() : null;
}

function centsToString(value: bigint | number | null): string | null {
  if (value === null) return null;
  return value.toString();
}

function toStringId(value: bigint | number | string | null): string | null {
  return value === null ? null : value.toString();
}

function normalizeErrors(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const message = (item as { message?: unknown }).message;
        return typeof message === 'string' ? message : JSON.stringify(item);
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function failureCategory(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('timeout') || lower.includes('timed out')) return 'timeout';
  if (lower.includes('fetch') || lower.includes('http') || lower.includes('status')) return 'fetch';
  if (lower.includes('json') || lower.includes('parse')) return 'parse';
  if (lower.includes('image')) return 'image';
  if (lower.includes('database') || lower.includes('prisma')) return 'database';
  return 'other';
}

export async function getAdminReviewDashboard() {
  const prisma = getPrismaClient();
  const [
    pendingReviewCount,
    highConfidenceCandidates,
    lowConfidenceCandidates,
    duplicateCandidates,
    unresolvedProducts,
    ingestionFailureQueue,
  ] = await Promise.all([
    prisma.reviewQueue.count({ where: { resolvedAt: null } }),
    prisma.reviewQueue.findMany({
      where: { resolvedAt: null, suggestedConfidence: { gte: 0.8 } },
      include: {
        rawProduct: { include: { vendor: true } },
        suggestedProduct: { select: { id: true, slug: true, name: true, status: true } },
      },
      orderBy: [{ suggestedConfidence: 'desc' }, { priority: 'asc' }],
      take: RECENT_REVIEW_LIMIT,
    }),
    prisma.reviewQueue.findMany({
      where: {
        resolvedAt: null,
        OR: [{ suggestedConfidence: null }, { suggestedConfidence: { lt: 0.8 } }],
      },
      include: {
        rawProduct: { include: { vendor: true } },
        suggestedProduct: { select: { id: true, slug: true, name: true, status: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: RECENT_REVIEW_LIMIT,
    }),
    prisma.$queryRaw<
      Array<{
        vendor_id: bigint;
        vendor_slug: string;
        duplicate_key: string;
        duplicate_count: number;
        raw_product_ids: string[];
      }>
    >`
      SELECT
        vrp.vendor_id,
        vs.slug::text AS vendor_slug,
        COALESCE(NULLIF(vrp.vendor_sku, ''), vrp.fingerprint, vrp.vendor_url) AS duplicate_key,
        COUNT(*)::int AS duplicate_count,
        array_agg(vrp.id::text ORDER BY vrp.scraped_at DESC) AS raw_product_ids
      FROM vendor_raw_products vrp
      JOIN vendor_sources vs ON vs.id = vrp.vendor_id
      WHERE vrp.match_status = 'unmatched'
      GROUP BY vrp.vendor_id, vs.slug, COALESCE(NULLIF(vrp.vendor_sku, ''), vrp.fingerprint, vrp.vendor_url)
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT ${REPORT_ROW_LIMIT}
    `,
    prisma.vendorRawProduct.findMany({
      where: {
        matchStatus: 'UNMATCHED',
        reviewQueue: null,
      },
      include: { vendor: true },
      orderBy: { scrapedAt: 'desc' },
      take: RECENT_REVIEW_LIMIT,
    }),
    prisma.ingestionRun.findMany({
      where: { status: { in: ['FAILED', 'PARTIAL'] } },
      include: { vendor: true },
      orderBy: { startedAt: 'desc' },
      take: RECENT_REVIEW_LIMIT,
    }),
  ]);

  const serializeCandidate = (item: (typeof highConfidenceCandidates)[number]) => ({
    id: item.id.toString(),
    rawProductId: item.rawProductId.toString(),
    suggestedProductId: item.suggestedProductId?.toString() ?? null,
    confidence: decimalToNumber(item.suggestedConfidence),
    priority: item.priority,
    createdAt: item.createdAt,
    rawProduct: {
      vendorSlug: item.rawProduct.vendor.slug,
      vendorUrl: item.rawProduct.vendorUrl,
      vendorSku: item.rawProduct.vendorSku,
      rawName: item.rawProduct.rawName,
      fingerprint: item.rawProduct.fingerprint,
    },
    suggestedProduct: item.suggestedProduct
      ? {
          id: item.suggestedProduct.id.toString(),
          slug: item.suggestedProduct.slug,
          name: item.suggestedProduct.name,
          status: item.suggestedProduct.status,
        }
      : null,
  });

  return {
    pendingReviewCount,
    highConfidenceCandidates: highConfidenceCandidates.map(serializeCandidate),
    lowConfidenceCandidates: lowConfidenceCandidates.map(serializeCandidate),
    duplicateCandidates: duplicateCandidates.map((item) => ({
      vendorId: item.vendor_id.toString(),
      vendorSlug: item.vendor_slug,
      duplicateKey: item.duplicate_key,
      duplicateCount: item.duplicate_count,
      rawProductIds: item.raw_product_ids,
    })),
    unresolvedProducts: unresolvedProducts.map((item) => ({
      id: item.id.toString(),
      vendorSlug: item.vendor.slug,
      vendorUrl: item.vendorUrl,
      vendorSku: item.vendorSku,
      rawName: item.rawName,
      fingerprint: item.fingerprint,
      scrapedAt: item.scrapedAt,
    })),
    ingestionFailureQueue: ingestionFailureQueue.map((run) => ({
      id: run.id.toString(),
      vendorSlug: run.vendor.slug,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      productsFound: run.productsFound,
      errors: normalizeErrors(run.errors).slice(0, 5),
    })),
  };
}

export async function getImageIntegrityReport() {
  const prisma = getPrismaClient();
  const [duplicateRawImages, brokenRawImages, missingMasterImages, missingRawImages, localRawImages] =
    await Promise.all([
      prisma.$queryRaw<
        Array<{ content_hash: string; image_count: number; raw_image_ids: string[] }>
      >`
        SELECT
          content_hash,
          COUNT(*)::int AS image_count,
          array_agg(id::text ORDER BY id) AS raw_image_ids
        FROM vendor_raw_images
        WHERE content_hash IS NOT NULL
        GROUP BY content_hash
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT ${REPORT_ROW_LIMIT}
      `,
      prisma.vendorRawImage.findMany({
        where: {
          OR: [{ downloadError: { not: null } }, { storageKey: null }],
        },
        include: { rawProduct: { include: { vendor: true } } },
        orderBy: { createdAt: 'desc' },
        take: REPORT_ROW_LIMIT,
      }),
      prisma.masterProduct.findMany({
        where: {
          status: { not: 'ARCHIVED' },
          images: { none: {} },
        },
        select: { id: true, slug: true, name: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: REPORT_ROW_LIMIT,
      }),
      prisma.$queryRaw<
        Array<{ raw_product_id: bigint; vendor_slug: string; vendor_url: string; raw_image_url_count: number }>
      >`
        SELECT
          vrp.id AS raw_product_id,
          vs.slug::text AS vendor_slug,
          vrp.vendor_url,
          cardinality(vrp.raw_image_urls)::int AS raw_image_url_count
        FROM vendor_raw_products vrp
        JOIN vendor_sources vs ON vs.id = vrp.vendor_id
        LEFT JOIN vendor_raw_images vri ON vri.raw_product_id = vrp.id
        WHERE cardinality(vrp.raw_image_urls) > 0
        GROUP BY vrp.id, vs.slug, vrp.vendor_url, vrp.raw_image_urls
        HAVING COUNT(vri.id) = 0
        ORDER BY vrp.scraped_at DESC
        LIMIT ${REPORT_ROW_LIMIT}
      `,
      prisma.vendorRawImage.findMany({
        where: { storageKey: { startsWith: 'local://catalog-raw/' } },
        select: { id: true, storageKey: true, contentHash: true, bytes: true },
        orderBy: { createdAt: 'desc' },
        take: REPORT_ROW_LIMIT,
      }),
    ]);

  const localAssetVerification = await Promise.all(
    localRawImages
      .filter((image): image is typeof image & { storageKey: string } => Boolean(image.storageKey))
      .map(async (image) => ({
        rawImageId: image.id.toString(),
        contentHash: image.contentHash,
        expectedBytes: image.bytes,
        ...(await verifyCatalogRawAsset(image.storageKey)),
      }))
  );

  return {
    duplicateImageDetection: duplicateRawImages.map((item) => ({
      contentHash: item.content_hash,
      imageCount: item.image_count,
      rawImageIds: item.raw_image_ids,
    })),
    brokenImageDetection: brokenRawImages.map((image) => ({
      id: image.id.toString(),
      rawProductId: image.rawProductId.toString(),
      vendorSlug: image.rawProduct.vendor.slug,
      originalUrl: image.originalUrl,
      storageKey: image.storageKey,
      downloadError: image.downloadError,
    })),
    missingImageDetection: {
      masterProducts: missingMasterImages.map((product) => ({
        id: product.id.toString(),
        slug: product.slug,
        name: product.name,
        status: product.status,
      })),
      rawProducts: missingRawImages.map((item) => ({
        rawProductId: item.raw_product_id.toString(),
        vendorSlug: item.vendor_slug,
        vendorUrl: item.vendor_url,
        rawImageUrlCount: item.raw_image_url_count,
      })),
    },
    imageHashComparison: duplicateRawImages.map((item) => ({
      contentHash: item.content_hash,
      rawImageIds: item.raw_image_ids,
    })),
    localAssetVerification,
  };
}

function median(values: bigint[]): bigint | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

export async function getPricingWorkflow(productId: bigint) {
  const prisma = getPrismaClient();
  const product = await prisma.masterProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      curatedPrice: {
        include: {
          selectedOffer: { include: { vendor: true } },
          selectedBy: { select: { id: true, email: true, name: true } },
        },
      },
      offers: {
        include: {
          vendor: true,
          priceHistory: { orderBy: { observedAt: 'desc' }, take: 25 },
        },
        orderBy: [{ status: 'asc' }, { priceCents: 'asc' }],
      },
    },
  });

  if (!product) return null;

  const activePrices = product.offers
    .filter((offer) => offer.status === 'ACTIVE' && offer.inStock === true && offer.priceCents !== null)
    .map((offer) => offer.priceCents as bigint);
  const medianPrice = median(activePrices);
  const currentLowestVendor = product.offers
    .filter((offer) => offer.status === 'ACTIVE' && offer.inStock === true && offer.priceCents !== null)
    .sort((a, b) => {
      const left = a.priceCents ?? 0n;
      const right = b.priceCents ?? 0n;
      return left < right ? -1 : left > right ? 1 : 0;
    })[0];

  const anomalies = product.offers
    .filter((offer) => offer.priceCents !== null && medianPrice !== null)
    .flatMap((offer) => {
      const price = offer.priceCents as bigint;
      const items: Array<{ offerId: string; vendorSlug: string; type: string; details: string }> = [];
      if (medianPrice && price > medianPrice * 2n) {
        items.push({
          offerId: offer.id.toString(),
          vendorSlug: offer.vendor.slug,
          type: 'above_median_2x',
          details: `${price.toString()} vs median ${medianPrice.toString()}`,
        });
      }
      if (medianPrice && price * 2n < medianPrice) {
        items.push({
          offerId: offer.id.toString(),
          vendorSlug: offer.vendor.slug,
          type: 'below_median_half',
          details: `${price.toString()} vs median ${medianPrice.toString()}`,
        });
      }

      const [latest, previous] = offer.priceHistory;
      if (latest && previous) {
        const diff = latest.priceCents > previous.priceCents
          ? latest.priceCents - previous.priceCents
          : previous.priceCents - latest.priceCents;
        if (previous.priceCents > 0n && diff * 100n > previous.priceCents * 50n) {
          items.push({
            offerId: offer.id.toString(),
            vendorSlug: offer.vendor.slug,
            type: 'price_swing_gt_50_percent',
            details: `${previous.priceCents.toString()} -> ${latest.priceCents.toString()}`,
          });
        }
      }

      return items;
    });

  return {
    product: {
      id: product.id.toString(),
      slug: product.slug,
      name: product.name,
      status: product.status,
    },
    currentLowestVendor: currentLowestVendor
      ? {
          offerId: currentLowestVendor.id.toString(),
          vendorId: currentLowestVendor.vendorId.toString(),
          vendorSlug: currentLowestVendor.vendor.slug,
          vendorName: currentLowestVendor.vendor.name,
          priceCents: centsToString(currentLowestVendor.priceCents),
          currency: currentLowestVendor.currency,
          inStock: currentLowestVendor.inStock,
        }
      : null,
    adminSelectedCuratedPrice: product.curatedPrice
      ? {
          id: product.curatedPrice.id.toString(),
          selectedOfferId: product.curatedPrice.selectedOfferId?.toString() ?? null,
          priceCents: product.curatedPrice.priceCents.toString(),
          currency: product.curatedPrice.currency,
          reason: product.curatedPrice.reason,
          selectedAt: product.curatedPrice.selectedAt,
          selectedBy: product.curatedPrice.selectedBy,
          selectedVendorSlug: product.curatedPrice.selectedOffer?.vendor.slug ?? null,
        }
      : null,
    vendorPriceHistoryTimeline: product.offers.map((offer) => ({
      offerId: offer.id.toString(),
      vendorId: offer.vendorId.toString(),
      vendorSlug: offer.vendor.slug,
      vendorName: offer.vendor.name,
      vendorSku: offer.vendorSku,
      vendorUrl: offer.vendorUrl,
      currentPriceCents: centsToString(offer.priceCents),
      currency: offer.currency,
      status: offer.status,
      inStock: offer.inStock,
      history: offer.priceHistory.map((history) => ({
        id: history.id.toString(),
        priceCents: history.priceCents.toString(),
        currency: history.currency,
        inStock: history.inStock,
        observedAt: history.observedAt,
      })),
    })),
    priceAnomalyDetection: anomalies,
  };
}

export async function getIngestionObservability() {
  const prisma = getPrismaClient();
  const runs = await prisma.ingestionRun.findMany({
    include: { vendor: true },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  const completed = runs.filter((run) => run.status === 'COMPLETED').length;
  const successRate = runs.length === 0 ? 1 : completed / runs.length;
  const latencies = runs
    .filter((run) => run.finishedAt)
    .map((run) => (run.finishedAt as Date).getTime() - run.startedAt.getTime());
  const averageLatencyMs =
    latencies.length === 0
      ? null
      : Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
  const categories = new Map<string, number>();

  for (const run of runs) {
    for (const message of normalizeErrors(run.errors)) {
      const category = failureCategory(message);
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
  }

  let queueBacklog: unknown;
  try {
    queueBacklog = await Promise.all(
      getCatalogQueues().map(async (queue) => ({
        name: queue.name,
        counts: await queue.getJobCounts(
          'waiting',
          'delayed',
          'active',
          'failed',
          'completed',
          'prioritized'
        ),
      }))
    );
  } catch (error) {
    queueBacklog = {
      unavailable: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    ingestionSuccessRate: {
      windowSize: runs.length,
      completed,
      failedOrPartial: runs.filter((run) => run.status === 'FAILED' || run.status === 'PARTIAL').length,
      rate: Number(successRate.toFixed(4)),
    },
    retryCount: runs.reduce((sum, run) => sum + normalizeErrors(run.errors).length, 0),
    failureCategories: Array.from(categories.entries()).map(([category, count]) => ({ category, count })),
    queueBacklog,
    processingLatency: {
      averageMs: averageLatencyMs,
      samples: latencies.length,
    },
    recentRuns: runs.slice(0, RECENT_REVIEW_LIMIT).map((run) => ({
      id: run.id.toString(),
      vendorSlug: run.vendor.slug,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      latencyMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
      productsFound: run.productsFound,
      errorCount: normalizeErrors(run.errors).length,
    })),
  };
}

export async function getReconciliationReport() {
  const prisma = getPrismaClient();
  const [projectionIssues, unpublishedOrphans, vendorOfferIntegrity] = await Promise.all([
    prisma.$queryRaw<Array<{ issue: string; public_id: string; slug: string }>>`
      WITH published AS (
        SELECT public_id, slug
        FROM master_products
        WHERE status = 'published'
      ),
      projected AS (
        SELECT public_id, slug
        FROM public_products
      )
      SELECT 'missing_projection' AS issue, p.public_id::text, p.slug::text
      FROM published p
      LEFT JOIN projected pp ON pp.public_id = p.public_id
      WHERE pp.public_id IS NULL
      UNION ALL
      SELECT 'stale_projection' AS issue, pp.public_id::text, pp.slug::text
      FROM projected pp
      LEFT JOIN published p ON p.public_id = pp.public_id
      WHERE p.public_id IS NULL
      ORDER BY issue, slug
      LIMIT ${REPORT_ROW_LIMIT}
    `,
    prisma.$queryRaw<
      Array<{ product_id: bigint; slug: string; status: string; active_offer_count: number }>
    >`
      SELECT
        mp.id AS product_id,
        mp.slug::text,
        mp.status::text,
        COUNT(vo.id)::int AS active_offer_count
      FROM master_products mp
      LEFT JOIN vendor_offers vo ON vo.product_id = mp.id AND vo.status = 'active'
      WHERE mp.status <> 'published'
        AND EXISTS (SELECT 1 FROM vendor_offers x WHERE x.product_id = mp.id)
      GROUP BY mp.id, mp.slug, mp.status
      ORDER BY active_offer_count DESC, mp.slug
      LIMIT ${REPORT_ROW_LIMIT}
    `,
    prisma.$queryRaw<
      Array<{ issue: string; offer_id: bigint; product_id: bigint; vendor_id: bigint; vendor_url: string }>
    >`
      SELECT 'active_offer_without_price' AS issue, id AS offer_id, product_id, vendor_id, vendor_url
      FROM vendor_offers
      WHERE status = 'active' AND price_cents IS NULL
      UNION ALL
      SELECT 'active_offer_not_seen_recently' AS issue, id AS offer_id, product_id, vendor_id, vendor_url
      FROM vendor_offers
      WHERE status = 'active' AND last_seen_at < now() - interval '30 days'
      ORDER BY issue, offer_id
      LIMIT ${REPORT_ROW_LIMIT}
    `,
  ]);

  let searchIndexMismatchReport: unknown;
  try {
    const config = getTypesenseConfig();
    if (!config.apiKey) {
      searchIndexMismatchReport = { available: false, reason: 'TYPESENSE_API_KEY is not configured' };
    } else {
      const [postgresCountRows, aliasTarget, indexedCount] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM public_products`,
        getTypesenseAliasTarget(config.collectionAlias, config),
        getTypesenseCollectionDocumentCount(config.collectionAlias, config),
      ]);
      const postgresCount = Number(postgresCountRows[0]?.count ?? 0n);

      searchIndexMismatchReport = {
        available: true,
        alias: config.collectionAlias,
        aliasTarget,
        postgresCount,
        indexedCount,
        mismatch: postgresCount !== indexedCount,
      };
    }
  } catch (error) {
    searchIndexMismatchReport = {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    projectionConsistencyDashboard: projectionIssues.map((item) => ({
      issue: item.issue,
      publicId: item.public_id,
      slug: item.slug,
    })),
    postgresqlVsSearchMismatchReport: searchIndexMismatchReport,
    unpublishedOrphanScan: unpublishedOrphans.map((item) => ({
      productId: item.product_id.toString(),
      slug: item.slug,
      status: item.status,
      activeOfferCount: item.active_offer_count,
    })),
    vendorOfferIntegrityScan: vendorOfferIntegrity.map((item) => ({
      issue: item.issue,
      offerId: item.offer_id.toString(),
      productId: item.product_id.toString(),
      vendorId: item.vendor_id.toString(),
      vendorUrl: item.vendor_url,
    })),
  };
}

export async function getAdminAuditVisibility(input: {
  entityType?: string;
  entityId?: bigint;
  limit?: number;
}) {
  const prisma = getPrismaClient();
  const rows = await prisma.adminAuditLog.findMany({
    where: {
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
    },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { occurredAt: 'desc' },
    take: input.limit ?? REPORT_ROW_LIMIT,
  });

  return rows.map((row) => ({
    id: row.id.toString(),
    user: row.user,
    entityType: row.entityType,
    entityId: row.entityId.toString(),
    action: row.action,
    diff: row.diff,
    requestId: row.requestId,
    occurredAt: row.occurredAt,
  }));
}

export async function upsertCuratedProductPrice(input: {
  productId: bigint;
  offerId?: bigint | null;
  priceCents: bigint;
  currency: string;
  reason?: string | null;
  selectedById: string;
}) {
  const prisma = getPrismaClient();

  return prisma.curatedProductPrice.upsert({
    where: { productId: input.productId },
    create: {
      productId: input.productId,
      selectedOfferId: input.offerId ?? null,
      priceCents: input.priceCents,
      currency: input.currency,
      reason: input.reason,
      selectedById: input.selectedById,
    },
    update: {
      selectedOfferId: input.offerId ?? null,
      priceCents: input.priceCents,
      currency: input.currency,
      reason: input.reason,
      selectedById: input.selectedById,
      selectedAt: new Date(),
    },
  });
}

export function serializeCuratedProductPrice(price: {
  id: bigint;
  productId: bigint;
  selectedOfferId: bigint | null;
  priceCents: bigint;
  currency: string;
  reason: string | null;
  selectedById: string;
  selectedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: price.id.toString(),
    productId: price.productId.toString(),
    selectedOfferId: toStringId(price.selectedOfferId),
    priceCents: price.priceCents.toString(),
    currency: price.currency,
    reason: price.reason,
    selectedById: price.selectedById,
    selectedAt: price.selectedAt,
    updatedAt: price.updatedAt,
  };
}
