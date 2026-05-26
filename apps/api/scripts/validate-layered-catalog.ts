import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

interface ScanResult {
  name: string;
  ok: boolean;
  severity: 'error' | 'info';
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

async function duplicateFingerprintScan(): Promise<ScanResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT
      fingerprint,
      COUNT(*)::int AS count,
      array_agg(id::text ORDER BY id) AS master_product_ids
    FROM master_products
    WHERE status <> 'archived'
    GROUP BY fingerprint
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, fingerprint
  `;

  return {
    name: 'duplicate fingerprint scan',
    ok: Array.isArray(rows) && rows.length === 0,
    severity: 'error',
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function orphanVendorOfferScan(): Promise<ScanResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT vo.id::text, vo.product_id::text, vo.vendor_id::text, vo.vendor_url
    FROM vendor_offers vo
    LEFT JOIN master_products mp ON mp.id = vo.product_id
    WHERE mp.id IS NULL
    ORDER BY vo.id
  `;

  return {
    name: 'orphan vendor offer scan',
    ok: Array.isArray(rows) && rows.length === 0,
    severity: 'error',
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function unpublishedMasterScan(): Promise<ScanResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT id::text, slug::text, status::text, updated_at
    FROM master_products
    WHERE status <> 'published'
    ORDER BY updated_at DESC
    LIMIT 100
  `;

  return {
    name: 'unpublished master scan',
    ok: true,
    severity: 'info',
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function missingImageScan(): Promise<ScanResult> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw`
    SELECT mp.id::text, mp.slug::text, mp.status::text
    FROM master_products mp
    WHERE mp.status = 'published'
      AND NOT EXISTS (
        SELECT 1
        FROM product_images pi
        WHERE pi.product_id = mp.id
          AND pi.is_primary = true
      )
    ORDER BY mp.slug
  `;

  return {
    name: 'missing image scan',
    ok: Array.isArray(rows) && rows.length === 0,
    severity: 'error',
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function projectionConsistencyScan(): Promise<ScanResult> {
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
  `;

  return {
    name: 'projection consistency scan',
    ok: Array.isArray(rows) && rows.length === 0,
    severity: 'error',
    count: Array.isArray(rows) ? rows.length : 0,
    rows: Array.isArray(rows) ? rows : [],
  };
}

async function main(): Promise<void> {
  const scans = await Promise.all([
    duplicateFingerprintScan(),
    orphanVendorOfferScan(),
    unpublishedMasterScan(),
    missingImageScan(),
    projectionConsistencyScan(),
  ]);
  const failed = scans.filter((scan) => !scan.ok && scan.severity === 'error');

  console.log(stringify({ ok: failed.length === 0, scans }));

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
