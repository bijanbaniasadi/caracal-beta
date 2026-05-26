import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

interface ValidationResult {
  name: string;
  ok: boolean;
  count: number;
  rows: unknown[];
}

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

async function reviewQueueIntegrity(): Promise<ValidationResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT 'resolved_missing_actor_or_action' AS issue, id::text, raw_product_id::text
    FROM review_queue
    WHERE resolved_at IS NOT NULL
      AND (resolved_by IS NULL OR resolved_action IS NULL)
    UNION ALL
    SELECT 'open_missing_raw_product' AS issue, rq.id::text, rq.raw_product_id::text
    FROM review_queue rq
    LEFT JOIN vendor_raw_products vrp ON vrp.id = rq.raw_product_id
    WHERE rq.resolved_at IS NULL
      AND vrp.id IS NULL
    ORDER BY issue, id
  `;

  return {
    name: 'review queue integrity',
    ok: Array.isArray(rows) && rows.length === 0,
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function duplicateReviewVerification(): Promise<ValidationResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT
      vrp.vendor_id::text,
      COALESCE(NULLIF(vrp.vendor_sku, ''), vrp.fingerprint, vrp.vendor_url) AS duplicate_key,
      COUNT(*)::int AS duplicate_count,
      COUNT(rq.id)::int AS review_count,
      array_agg(vrp.id::text ORDER BY vrp.id) AS raw_product_ids
    FROM vendor_raw_products vrp
    LEFT JOIN review_queue rq ON rq.raw_product_id = vrp.id AND rq.resolved_at IS NULL
    WHERE vrp.match_status = 'unmatched'
    GROUP BY vrp.vendor_id, COALESCE(NULLIF(vrp.vendor_sku, ''), vrp.fingerprint, vrp.vendor_url)
    HAVING COUNT(*) > 1
       AND COUNT(rq.id) = 0
    ORDER BY duplicate_count DESC
  `;

  return {
    name: 'duplicate review verification',
    ok: Array.isArray(rows) && rows.length === 0,
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function imageIntegrityVerification(): Promise<ValidationResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT 'broken_raw_image' AS issue, id::text AS id, original_url AS detail
    FROM vendor_raw_images
    WHERE download_error IS NOT NULL OR storage_key IS NULL
    UNION ALL
    SELECT 'published_missing_primary_image' AS issue, mp.id::text AS id, mp.slug::text AS detail
    FROM master_products mp
    WHERE mp.status = 'published'
      AND NOT EXISTS (
        SELECT 1
        FROM product_images pi
        WHERE pi.product_id = mp.id
          AND pi.is_primary = true
      )
    ORDER BY issue, id
  `;

  return {
    name: 'image integrity verification',
    ok: Array.isArray(rows) && rows.length === 0,
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function pricingIntegrityVerification(): Promise<ValidationResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT 'curated_offer_wrong_product' AS issue, cpp.id::text AS id, cpp.product_id::text AS detail
    FROM curated_product_prices cpp
    JOIN vendor_offers vo ON vo.id = cpp.selected_offer_id
    WHERE vo.product_id <> cpp.product_id
    UNION ALL
    SELECT 'active_offer_without_price' AS issue, vo.id::text AS id, vo.product_id::text AS detail
    FROM vendor_offers vo
    WHERE vo.status = 'active'
      AND vo.price_cents IS NULL
    UNION ALL
    SELECT 'price_history_without_offer' AS issue, ph.id::text AS id, ph.offer_id::text AS detail
    FROM price_history ph
    LEFT JOIN vendor_offers vo ON vo.id = ph.offer_id
    WHERE vo.id IS NULL
    ORDER BY issue, id
  `;

  return {
    name: 'pricing integrity verification',
    ok: Array.isArray(rows) && rows.length === 0,
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function reconciliationVerification(): Promise<ValidationResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    WITH published AS (
      SELECT public_id, slug
      FROM master_products
      WHERE status = 'published'
    ),
    projected AS (
      SELECT public_id, slug
      FROM public_products
    )
    SELECT 'missing_projection' AS issue, p.public_id::text AS id, p.slug::text AS detail
    FROM published p
    LEFT JOIN projected pp ON pp.public_id = p.public_id
    WHERE pp.public_id IS NULL
    UNION ALL
    SELECT 'stale_projection' AS issue, pp.public_id::text AS id, pp.slug::text AS detail
    FROM projected pp
    LEFT JOIN published p ON p.public_id = pp.public_id
    WHERE p.public_id IS NULL
    UNION ALL
    SELECT 'vendor_offer_missing_vendor' AS issue, vo.id::text AS id, vo.vendor_id::text AS detail
    FROM vendor_offers vo
    LEFT JOIN vendor_sources vs ON vs.id = vo.vendor_id
    WHERE vs.id IS NULL
    ORDER BY issue, detail
  `;

  return {
    name: 'reconciliation verification',
    ok: Array.isArray(rows) && rows.length === 0,
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function main(): Promise<void> {
  const validations = await Promise.all([
    reviewQueueIntegrity(),
    duplicateReviewVerification(),
    imageIntegrityVerification(),
    pricingIntegrityVerification(),
    reconciliationVerification(),
  ]);
  const failed = validations.filter((validation) => !validation.ok);

  console.log(stringify({ ok: failed.length === 0, validations }));

  if (failed.length > 0) {
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
