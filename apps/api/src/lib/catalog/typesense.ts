import { z } from 'zod';

export interface TypesenseConfig {
  url: string;
  apiKey: string;
  collectionAlias: string;
  collectionPrefix: string;
}

export const typesenseProductDocumentSchema = z.object({
  id: z.string().uuid(),
  public_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  short_description: z.string().nullable(),
  manufacturer_slug: z.string().min(1),
  manufacturer_name: z.string().min(1),
  category_slug: z.string().min(1),
  category_path: z.array(z.string()),
  tags: z.array(z.string()),
  compatibility: z.array(z.string()),
  best_price_cents: z.number().int().nullable(),
  in_stock: z.boolean(),
  offer_count: z.number().int().nonnegative(),
  featured: z.boolean(),
  published_at: z.number().int().nonnegative(),
  primary_image_key: z.string().nullable(),
});

export type TypesenseProductDocument = z.infer<typeof typesenseProductDocumentSchema>;

export const productsCollectionSchema = {
  name: 'products_v1',
  fields: [
    { name: 'public_id', type: 'string' },
    { name: 'slug', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'short_description', type: 'string', optional: true },
    { name: 'manufacturer_slug', type: 'string', facet: true },
    { name: 'manufacturer_name', type: 'string', facet: true },
    { name: 'category_slug', type: 'string', facet: true },
    { name: 'category_path', type: 'string[]', facet: true },
    { name: 'tags', type: 'string[]', facet: true },
    { name: 'compatibility', type: 'string[]', facet: true },
    { name: 'best_price_cents', type: 'int64', optional: true, sort: true },
    { name: 'in_stock', type: 'bool', facet: true },
    { name: 'offer_count', type: 'int32', sort: true },
    { name: 'featured', type: 'bool', facet: true, sort: true },
    { name: 'published_at', type: 'int64', sort: true },
    { name: 'primary_image_key', type: 'string', optional: true, index: false },
  ],
  default_sorting_field: 'published_at',
} as const;

export function getTypesenseConfig(source: NodeJS.ProcessEnv = process.env): TypesenseConfig {
  return {
    url: (source.TYPESENSE_URL ?? 'http://localhost:8108').replace(/\/+$/, ''),
    apiKey: source.TYPESENSE_API_KEY ?? '',
    collectionAlias: source.TYPESENSE_COLLECTION_ALIAS ?? 'products',
    collectionPrefix: source.TYPESENSE_COLLECTION_PREFIX ?? 'products',
  };
}

function requireTypesenseConfig(config = getTypesenseConfig()): TypesenseConfig {
  if (!config.apiKey) {
    throw new Error('TYPESENSE_API_KEY is required for catalog projection writes.');
  }

  return config;
}

async function typesenseFetch(
  path: string,
  init: RequestInit = {},
  config = requireTypesenseConfig()
): Promise<Response> {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-TYPESENSE-API-KEY': config.apiKey,
      ...init.headers,
    },
  });
}

export async function upsertTypesenseProduct(
  input: TypesenseProductDocument,
  config = requireTypesenseConfig()
): Promise<void> {
  const document = typesenseProductDocumentSchema.parse(input);
  const response = await typesenseFetch(
    `/collections/${encodeURIComponent(config.collectionAlias)}/documents?action=upsert`,
    {
      method: 'POST',
      body: JSON.stringify(document),
    },
    config
  );

  if (!response.ok) {
    throw new Error(`Typesense product upsert failed: ${response.status} ${await response.text()}`);
  }
}

export async function deleteTypesenseProduct(
  publicId: string,
  config = requireTypesenseConfig()
): Promise<void> {
  const response = await typesenseFetch(
    `/collections/${encodeURIComponent(config.collectionAlias)}/documents/${encodeURIComponent(publicId)}`,
    { method: 'DELETE' },
    config
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Typesense product delete failed: ${response.status} ${await response.text()}`);
  }
}
