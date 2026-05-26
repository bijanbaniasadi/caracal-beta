import { disconnectPrismaClient, getPrismaClient } from '@caracal/db';

import { catalogQueueNames } from '../src/lib/catalog/queues.js';
import { getTypesenseConfig } from '../src/lib/catalog/typesense.js';

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
  'admin_audit_log',
  'public_products',
] as const;

const requiredIndexes = [
  'master_products_live_fingerprint_unique',
  'product_images_one_primary_image',
  'public_products_public_id_idx',
  'public_products_slug_idx',
] as const;

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

async function main(): Promise<void> {
  const checks = [await relationCheck(), await indexCheck(), queueCheck(), typesenseConfigCheck()];
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
