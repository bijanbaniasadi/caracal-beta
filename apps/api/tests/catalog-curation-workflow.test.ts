import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(testDir, '..');

function readApiFile(path: string): string {
  return readFileSync(resolve(apiRoot, path), 'utf8');
}

describe('catalog curation workflow invariants', () => {
  it('keeps curation route from mutating the search index directly', () => {
    const route = readApiFile('src/routes/admin-catalog-curation.ts');

    expect(route).not.toMatch(
      /upsertTypesenseProduct|deleteTypesenseProduct|importTypesenseProducts/i
    );
    expect(route).not.toMatch(/from ['"].*typesense/i);
  });

  it('keeps master product writes inside admin review or master catalog workflows', () => {
    const allowedFiles = ['src/routes/admin-master-catalog.ts', 'src/routes/admin-review-queue.ts'];
    const operatorRoute = readApiFile('src/routes/admin-catalog-curation.ts');
    const mk3Ingestion = readApiFile('src/lib/catalog/mk3/ingestion.ts');
    const mk3Matching = readApiFile('src/lib/catalog/mk3/matching.ts');

    for (const allowedFile of allowedFiles) {
      expect(readApiFile(allowedFile)).toMatch(/masterProduct\.(create|update|delete)/);
    }
    expect(operatorRoute).not.toMatch(/masterProduct\.(create|update|delete|upsert)/);
    expect(mk3Ingestion).not.toMatch(/masterProduct\.(create|update|delete|upsert)/);
    expect(mk3Matching).not.toMatch(/masterProduct\.(create|update|delete|upsert)/);
  });

  it('adds review actions without destructive raw product cleanup', () => {
    const route = readApiFile('src/routes/admin-review-queue.ts');

    expect(route).toContain('/:id/approve-match');
    expect(route).toContain('/:id/merge-duplicate');
    expect(route).toContain('/:id/archive');
    expect(route).toContain('/:id/refingerprint');
    expect(route).not.toMatch(/vendorRawProduct\.delete|vendorRawProduct\.deleteMany/);
  });

  it('stores curated pricing outside the public projection contract', () => {
    const migration = readApiFile(
      'prisma/migrations/20260526203000_curation_operator_tooling/migration.sql'
    );
    const phase2Projection = readApiFile(
      'prisma/migrations/20260526170000_catalog_phase2_hardening/migration.sql'
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS curated_product_prices');
    expect(migration).toContain('Not used by public_products');
    expect(phase2Projection).not.toContain('curated_product_prices');
  });

  it('keeps review-created master fingerprints server-owned', () => {
    const schema = readApiFile('src/schemas/master-catalog.ts');
    const route = readApiFile('src/routes/admin-review-queue.ts');

    expect(schema).toMatch(/masterProductCreateSchema\s*\.omit\(\{\s*fingerprint:\s*true\s*\}\)/);
    expect(route).toContain('fingerprintFromRawProduct');
    expect(route).toContain('buildMk3Fingerprint');
    expect(route).not.toContain('fingerprint: input.fingerprint');
  });
});
