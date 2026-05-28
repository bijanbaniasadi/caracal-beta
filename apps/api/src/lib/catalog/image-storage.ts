/**
 * Catalog image storage abstraction (M2a).
 *
 * The enrichment pipeline downloads images from manufacturer CDNs and uploads
 * them to a place the public catalog can serve. M2a uses the VPS /media/
 * nginx-served directory (host: /var/www/caracal-media, container mount path:
 * /app/catalog-media, read-write). M2b will swap in a Cloudflare R2 implementation
 * by writing `R2Storage implements CatalogImageStorage` — no change to callers.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface CatalogImageUploadInput {
  /** Buffer of the image bytes. */
  bytes: Buffer;
  /** Logical path namespace (e.g. 'products/autotuner/MKON332-0'). No leading slash. */
  key: string;
  /** Image extension (jpg/png/webp/…). Without the dot. */
  extension: string;
  /** MIME type for downstream metadata. */
  contentType?: string | null;
}

export interface CatalogImageUploadResult {
  /** Public URL where the image is served. Stored on catalog_product_images.storage_key. */
  publicUrl: string;
  /** Internal storage identifier (file path / object key). For diagnostics. */
  storageKey: string;
  /** sha256 of the bytes. For dedupe / diagnostics. */
  sha256: string;
  /** Size in bytes. */
  bytes: number;
}

export interface CatalogImageStorage {
  /** Stable name for logging (e.g. 'vps-media', 'r2'). */
  readonly backend: string;
  /** Upload an image blob and return the public URL. */
  upload(input: CatalogImageUploadInput): Promise<CatalogImageUploadResult>;
}

// ---------------------------------------------------------------------------
// VPS /media implementation
// ---------------------------------------------------------------------------

export interface VpsMediaStorageOptions {
  /** Absolute root directory the api container can WRITE to (mounted from
   *  /var/www/caracal-media on the host). e.g. '/app/catalog-media'. */
  containerRoot: string;
  /** Public base URL where nginx serves the same files. e.g. 'https://new.caracaltechmotors.com'. */
  publicBaseUrl: string;
  /** URL prefix nginx maps to the media root. e.g. '/media'. */
  publicPathPrefix?: string;
}

export class VpsMediaStorage implements CatalogImageStorage {
  readonly backend = 'vps-media';
  private readonly containerRoot: string;
  private readonly publicBaseUrl: string;
  private readonly publicPathPrefix: string;

  constructor(options: VpsMediaStorageOptions) {
    this.containerRoot = options.containerRoot.replace(/\/+$/, '');
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, '');
    this.publicPathPrefix = (options.publicPathPrefix ?? '/media').replace(/^\/?/, '/').replace(/\/+$/, '');
  }

  async upload(input: CatalogImageUploadInput): Promise<CatalogImageUploadResult> {
    const sha = createHash('sha256').update(input.bytes).digest('hex');
    const ext = sanitizeExtension(input.extension);
    const relativePath = `${input.key}.${ext}`.replace(/^\/+/, '');
    const absolutePath = join(this.containerRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes);
    return {
      publicUrl: `${this.publicBaseUrl}${this.publicPathPrefix}/${relativePath}`,
      storageKey: `vps-media://${relativePath}`,
      sha256: sha,
      bytes: input.bytes.length,
    };
  }
}

function sanitizeExtension(extension: string): string {
  const cleaned = (extension || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned) return 'bin';
  if (cleaned === 'jpeg') return 'jpg';
  return cleaned;
}

// ---------------------------------------------------------------------------
// Helper to construct the right backend from env
// ---------------------------------------------------------------------------

export function defaultCatalogImageStorage(): CatalogImageStorage {
  const publicBaseUrl = process.env.PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (!publicBaseUrl) {
    throw new Error('PUBLIC_SITE_URL must be set to construct image storage URLs.');
  }
  const containerRoot = process.env.CATALOG_MEDIA_DIR ?? '/app/catalog-media';
  return new VpsMediaStorage({
    containerRoot,
    publicBaseUrl,
    publicPathPrefix: process.env.CATALOG_MEDIA_PUBLIC_PATH ?? '/media',
  });
}

export function extensionFromContentType(contentType: string | null | undefined): string {
  if (!contentType) return 'bin';
  const ct = contentType.toLowerCase();
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('avif')) return 'avif';
  return 'bin';
}
