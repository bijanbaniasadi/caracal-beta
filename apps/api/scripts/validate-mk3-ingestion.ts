import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

interface CheckResult {
  name: string;
  ok: boolean;
  count: number;
  details?: unknown;
}

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  const runId = process.argv[2] ? BigInt(process.argv[2]) : null;
  const vendor = await prisma.vendorSource.findUnique({ where: { slug: 'mk3' } });
  const checks: CheckResult[] = [];

  checks.push({
    name: 'MK3 vendor source',
    ok: Boolean(vendor),
    count: vendor ? 1 : 0,
    details: vendor
      ? { id: vendor.id.toString(), baseUrl: vendor.baseUrl, enabled: vendor.enabled }
      : null,
  });

  if (!vendor) {
    console.log(stringify({ ok: false, runId: runId?.toString() ?? null, checks }));
    process.exitCode = 1;
    return;
  }

  const runWhere = runId ? { ingestionRunId: runId, vendorId: vendor.id } : { vendorId: vendor.id };
  const [rawProductCount, reviewQueueCount, rawImageCount] = await Promise.all([
    prisma.vendorRawProduct.count({ where: runWhere }),
    prisma.reviewQueue.count({
      where: { rawProduct: runWhere },
    }),
    prisma.vendorRawImage.count({
      where: { rawProduct: runWhere },
    }),
  ]);
  const duplicateRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH scoped AS (
      SELECT vendor_url, vendor_sku
      FROM vendor_raw_products
      WHERE vendor_id = ${vendor.id}
        AND (${runId}::bigint IS NULL OR ingestion_run_id = ${runId}::bigint)
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
  `;
  const orphanRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM vendor_raw_images vri
    LEFT JOIN vendor_raw_products vrp ON vrp.id = vri.raw_product_id
    WHERE vrp.id IS NULL
  `;
  const duplicateExternalCount = Number(duplicateRows[0]?.count ?? 0n);
  const orphanRawImageCount = Number(orphanRows[0]?.count ?? 0n);

  checks.push(
    {
      name: 'MK3 raw product count',
      ok: true,
      count: rawProductCount,
    },
    {
      name: 'duplicate external URL/SKU count',
      ok: duplicateExternalCount === 0,
      count: duplicateExternalCount,
    },
    {
      name: 'review queue count',
      ok: true,
      count: reviewQueueCount,
    },
    {
      name: 'raw image count',
      ok: true,
      count: rawImageCount,
    },
    {
      name: 'orphan raw image count',
      ok: orphanRawImageCount === 0,
      count: orphanRawImageCount,
    }
  );

  const failed = checks.filter((check) => !check.ok);
  console.log(stringify({ ok: failed.length === 0, runId: runId?.toString() ?? null, checks }));

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
