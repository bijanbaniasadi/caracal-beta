import { z } from 'zod';

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
