import { z } from 'zod';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const objectStorageConfigSchema = z.object({
  endpoint: z.string().url().optional(),
  region: z.string().min(1).default('auto'),
  imageBucket: z.string().min(1).optional(),
  rawHtmlBucket: z.string().min(1).optional(),
  backupBucket: z.string().min(1).optional(),
  accessKeyId: z.string().min(1).optional(),
  secretAccessKey: z.string().min(1).optional(),
  publicBaseUrl: z.string().url().optional(),
});

export type CatalogObjectStorageConfig = z.infer<typeof objectStorageConfigSchema>;

export interface StoredCatalogRawAsset {
  storageKey: string;
  sha256: string;
  bytes: number;
}

export function loadCatalogObjectStorageConfig(
  source: NodeJS.ProcessEnv = process.env
): CatalogObjectStorageConfig {
  return objectStorageConfigSchema.parse({
    endpoint: source.CATALOG_OBJECT_STORAGE_ENDPOINT || undefined,
    region: source.CATALOG_OBJECT_STORAGE_REGION || 'auto',
    imageBucket: source.CATALOG_IMAGE_BUCKET || undefined,
    rawHtmlBucket: source.CATALOG_RAW_HTML_BUCKET || undefined,
    backupBucket: source.CATALOG_BACKUP_BUCKET || undefined,
    accessKeyId: source.CATALOG_OBJECT_STORAGE_ACCESS_KEY_ID || undefined,
    secretAccessKey: source.CATALOG_OBJECT_STORAGE_SECRET_ACCESS_KEY || undefined,
    publicBaseUrl: source.CATALOG_IMAGE_PUBLIC_BASE_URL || undefined,
  });
}

export function isCatalogObjectStorageConfigured(
  config = loadCatalogObjectStorageConfig()
): boolean {
  return Boolean(
    config.endpoint &&
      config.imageBucket &&
      config.rawHtmlBucket &&
      config.accessKeyId &&
      config.secretAccessKey
  );
}

function rawAssetDirectory(source: NodeJS.ProcessEnv = process.env): string {
  return source.CATALOG_RAW_ASSET_DIR ?? join(process.cwd(), 'storage', 'catalog-raw');
}

function safeExtension(extension: string): string {
  return extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
}

export async function writeCatalogRawAsset(
  namespace: string,
  input: Buffer | string,
  extension = 'bin',
  source: NodeJS.ProcessEnv = process.env
): Promise<StoredCatalogRawAsset> {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const ext = safeExtension(extension);
  const dir = join(rawAssetDirectory(source), namespace, sha256.slice(0, 2));
  const filePath = join(dir, `${sha256}.${ext}`);

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, bytes);

  return {
    storageKey: `local://catalog-raw/${namespace}/${sha256.slice(0, 2)}/${sha256}.${ext}`,
    sha256,
    bytes: bytes.length,
  };
}
