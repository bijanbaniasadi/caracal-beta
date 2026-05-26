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

async function main(): Promise<void> {
  const scans = await Promise.all([
    duplicateFingerprintScan(),
    orphanVendorOfferScan(),
    unpublishedMasterScan(),
    missingImageScan(),
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
