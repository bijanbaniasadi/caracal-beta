import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(testDir, '..');

function readApiFile(path: string): string {
  return readFileSync(resolve(apiRoot, path), 'utf8');
}

function block(source: string, name: string): string {
  return source.match(new RegExp(String.raw`model ${name} \{[\s\S]*?\n\}`))?.[0] ?? '';
}

describe('catalog architecture invariants', () => {
  it('keeps public_products as an ignored Prisma materialized view', () => {
    const schema = readApiFile('prisma/schema.prisma');
    const publicProduct = block(schema, 'PublicProduct');

    expect(publicProduct).toContain('@@ignore');
    expect(publicProduct).toContain('@@map("public_products")');
  });

  it('uses partial live-only SKU uniqueness for master products', () => {
    const schema = readApiFile('prisma/schema.prisma');
    const migration = readApiFile(
      'prisma/migrations/20260526170000_catalog_phase2_hardening/migration.sql'
    );
    const masterProduct = block(schema, 'MasterProduct');

    expect(masterProduct).not.toMatch(/sku\s+String\??\s+@unique/);
    expect(migration).toContain('master_products_live_sku_unique');
    expect(migration).toContain("WHERE sku IS NOT NULL AND status <> 'archived'");
  });

  it('prevents API routes from writing to Typesense directly', () => {
    const routeFiles = [
      'src/routes/admin-master-catalog.ts',
      'src/routes/admin-review-queue.ts',
    ];

    for (const routeFile of routeFiles) {
      expect(readApiFile(routeFile)).not.toMatch(/typesense|upsertTypesenseProduct|deleteTypesenseProduct/i);
    }
  });

  it('keeps search-index queue as a projection delegate', () => {
    const worker = readApiFile('src/workers/projection-worker.ts');
    const projectionCalls = worker.match(/projectMasterProductToSearch\(/g) ?? [];

    expect(projectionCalls).toHaveLength(1);
    expect(worker).toContain('delegated-to-projection');
    expect(worker).toContain('delegated-full-reindex-to-projection');
  });

  it('does not allow catalog workers to mutate master product rows directly', () => {
    const workerFiles = [
      'src/workers/ingestion-worker.ts',
      'src/workers/fingerprint-worker.ts',
      'src/workers/image-pipeline-worker.ts',
      'src/workers/projection-worker.ts',
      'src/workers/reconciliation-worker.ts',
    ];
    const forbidden = /prisma\.masterProduct\.(create|update|delete)/;

    for (const workerFile of workerFiles) {
      expect(readApiFile(workerFile), workerFile).not.toMatch(forbidden);
    }
  });

  it('implements alias-swap reindex primitives', () => {
    const typesense = readApiFile('src/lib/catalog/typesense.ts');
    const projection = readApiFile('src/lib/catalog/projection.ts');

    expect(typesense).toContain('/aliases/');
    expect(typesense).toContain('collection_name');
    expect(projection).toContain('reindexAllPublicProductsWithAliasSwap');
    expect(projection).toContain('getTypesenseCollectionDocumentCount');
    expect(projection).toContain('deleteTypesenseCollection');
  });
});
