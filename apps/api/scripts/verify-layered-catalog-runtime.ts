import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { catalogQueueNames } from '../src/lib/catalog/queues.js';
import { isCatalogObjectStorageConfigured } from '../src/lib/catalog/object-storage.js';
import {
  getTypesenseAliasTarget,
  getTypesenseCollectionDocumentCount,
  getTypesenseConfig,
} from '../src/lib/catalog/typesense.js';

interface RuntimeCheck {
  name: string;
  ok: boolean;
  details?: unknown;
}

const requiredRelations = [
  'vendor_sources',
  'ingestion_runs',
  'vendor_raw_products',
  'vendor_raw_images',
  'master_products',
  'vendor_offers',
  'product_images',
  'categories',
  'manufacturers',
  'tags',
  'master_product_tags',
  'master_product_specs',
  'master_product_compatibility',
  'price_history',
  'review_queue',
  'admin_audit_log',
  'public_products',
] as const;

const requiredIndexes = [
  'master_products_live_fingerprint_unique',
  'master_products_live_sku_unique',
  'product_images_one_primary_image',
  'price_history_offer_time_idx',
  'review_queue_open_idx',
  'public_products_public_id_idx',
  'public_products_slug_idx',
] as const;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '..');

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === 'bigint' ? item.toString() : item),
    2
  );
}

async function relationCheck(): Promise<RuntimeCheck> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ relation_name: string; exists: boolean }>>`
    SELECT relation_name, to_regclass(relation_name) IS NOT NULL AS exists
    FROM unnest(${requiredRelations}::text[]) AS relation_name
    ORDER BY relation_name
  `;
  const missing = rows.filter((row) => !row.exists).map((row) => row.relation_name);

  return {
    name: 'layered catalog relations',
    ok: missing.length === 0,
    details: { missing, rows },
  };
}

async function indexCheck(): Promise<RuntimeCheck> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ index_name: string; exists: boolean }>>`
    SELECT index_name, to_regclass(index_name) IS NOT NULL AS exists
    FROM unnest(${requiredIndexes}::text[]) AS index_name
    ORDER BY index_name
  `;
  const missing = rows.filter((row) => !row.exists).map((row) => row.index_name);

  return {
    name: 'layered catalog indexes',
    ok: missing.length === 0,
    details: { missing, rows },
  };
}

function queueCheck(): RuntimeCheck {
  const expected = {
    ingestion: 'ingestion',
    fingerprint: 'fingerprint',
    imagePipeline: 'image-pipeline',
    projection: 'projection',
    searchIndex: 'search-index',
    reconciliation: 'reconciliation',
  };
  const mismatches = Object.entries(expected).filter(
    ([key, value]) => catalogQueueNames[key as keyof typeof catalogQueueNames] !== value
  );

  return {
    name: 'catalog queue names',
    ok: mismatches.length === 0,
    details: { queueNames: catalogQueueNames, expected, mismatches },
  };
}

async function materializedViewCheck(): Promise<RuntimeCheck> {
  const prisma = getPrismaClient();
  const relationRows = await prisma.$queryRaw<Array<{ relkind: string | null }>>`
    SELECT c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'public_products'
    LIMIT 1
  `;
  const anomalyRows = await prisma.$queryRaw<Array<{ issue: string; count: bigint }>>`
    WITH published AS (
      SELECT public_id FROM master_products WHERE status = 'published'
    ),
    projected AS (
      SELECT public_id FROM public_products
    )
    SELECT 'missing_projection' AS issue, COUNT(*)::bigint AS count
    FROM published p
    LEFT JOIN projected pp ON pp.public_id = p.public_id
    WHERE pp.public_id IS NULL
    UNION ALL
    SELECT 'stale_projection' AS issue, COUNT(*)::bigint AS count
    FROM projected pp
    LEFT JOIN published p ON p.public_id = pp.public_id
    WHERE p.public_id IS NULL
  `;
  const anomalies = anomalyRows.filter((row) => row.count > 0n);

  return {
    name: 'public_products materialized view',
    ok: relationRows[0]?.relkind === 'm' && anomalies.length === 0,
    details: { relation: relationRows[0] ?? null, anomalies },
  };
}

async function prismaMatviewProtectionCheck(): Promise<RuntimeCheck> {
  const schema = await readFile(resolve(apiRoot, 'prisma', 'schema.prisma'), 'utf8');
  const publicProductBlock = schema.match(/model PublicProduct \{[\s\S]*?\n\}/)?.[0] ?? '';

  return {
    name: 'Prisma public_products drift protection',
    ok: publicProductBlock.includes('@@ignore') && publicProductBlock.includes('@@map("public_products")'),
    details: {
      hasPublicProductModel: Boolean(publicProductBlock),
      ignored: publicProductBlock.includes('@@ignore'),
      mapped: publicProductBlock.includes('@@map("public_products")'),
    },
  };
}

function typesenseConfigCheck(): RuntimeCheck {
  const config = getTypesenseConfig();

  return {
    name: 'typesense projection config',
    ok: Boolean(config.url && config.collectionAlias && config.collectionPrefix),
    details: {
      url: config.url,
      collectionAlias: config.collectionAlias,
      collectionPrefix: config.collectionPrefix,
      hasApiKey: Boolean(config.apiKey),
    },
  };
}

async function postgresPublicProductCount(): Promise<number> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM public_products
  `;

  return Number(rows[0]?.count ?? 0n);
}

async function typesenseAliasIntegrityCheck(): Promise<RuntimeCheck> {
  const config = getTypesenseConfig();

  if (!config.apiKey) {
    return {
      name: 'Typesense alias integrity',
      ok: false,
      details: { reason: 'TYPESENSE_API_KEY is not configured' },
    };
  }

  const target = await getTypesenseAliasTarget(config.collectionAlias, config);
  const expectedPrefix = `${config.collectionPrefix}_v_`;

  return {
    name: 'Typesense alias integrity',
    ok: Boolean(target?.startsWith(expectedPrefix)),
    details: {
      alias: config.collectionAlias,
      target,
      expectedPrefix,
    },
  };
}

async function typesenseCountCheck(): Promise<RuntimeCheck> {
  const config = getTypesenseConfig();

  if (!config.apiKey) {
    return {
      name: 'PostgreSQL vs Typesense indexed-count',
      ok: false,
      details: { reason: 'TYPESENSE_API_KEY is not configured' },
    };
  }

  const [postgresCount, typesenseCount] = await Promise.all([
    postgresPublicProductCount(),
    getTypesenseCollectionDocumentCount(config.collectionAlias, config),
  ]);

  return {
    name: 'PostgreSQL vs Typesense indexed-count',
    ok: postgresCount === typesenseCount,
    details: { postgresCount, typesenseCount, alias: config.collectionAlias },
  };
}

async function workerBoundaryCheck(): Promise<RuntimeCheck> {
  const workerFiles = [
    'src/workers/ingestion-worker.ts',
    'src/workers/fingerprint-worker.ts',
    'src/workers/image-pipeline-worker.ts',
    'src/workers/projection-worker.ts',
    'src/workers/reconciliation-worker.ts',
    'src/lib/catalog/mk3/ingestion.ts',
    'src/lib/catalog/mk3/matching.ts',
  ];
  const forbidden = [
    /prisma\.masterProduct\.create/,
    /prisma\.masterProduct\.update/,
    /prisma\.masterProduct\.delete/,
  ];
  const violations: Array<{ file: string; pattern: string }> = [];

  await Promise.all(
    workerFiles.map(async (file) => {
      const contents = await readFile(resolve(apiRoot, file), 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(contents)) {
          violations.push({ file, pattern: pattern.source });
        }
      }
    })
  );

  return {
    name: 'worker boundary verification',
    ok: violations.length === 0,
    details: { violations },
  };
}

async function routeTypesenseBoundaryCheck(): Promise<RuntimeCheck> {
  const routeFiles = [
    'src/routes/admin-master-catalog.ts',
    'src/routes/admin-review-queue.ts',
    'src/routes/admin-mk3-ingestion.ts',
  ];
  const violations: string[] = [];

  await Promise.all(
    routeFiles.map(async (file) => {
      const contents = await readFile(resolve(apiRoot, file), 'utf8');
      if (/typesense|upsertTypesenseProduct|deleteTypesenseProduct/i.test(contents)) {
        violations.push(file);
      }
    })
  );

  return {
    name: 'API route Typesense boundary',
    ok: violations.length === 0,
    details: { violations },
  };
}

function objectStorageGroundworkCheck(): RuntimeCheck {
  return {
    name: 'catalog object-storage groundwork',
    ok: true,
    details: { configured: isCatalogObjectStorageConfigured() },
  };
}

async function main(): Promise<void> {
  const checks = [
    await relationCheck(),
    await indexCheck(),
    await materializedViewCheck(),
    await prismaMatviewProtectionCheck(),
    queueCheck(),
    typesenseConfigCheck(),
    await typesenseAliasIntegrityCheck(),
    await typesenseCountCheck(),
    await workerBoundaryCheck(),
    await routeTypesenseBoundaryCheck(),
    objectStorageGroundworkCheck(),
  ];
  const failed = checks.filter((check) => !check.ok);

  console.log(stringify({ ok: failed.length === 0, checks }));

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
