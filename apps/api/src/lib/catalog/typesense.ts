import { z } from 'zod';

export interface TypesenseConfig {
  url: string;
  apiKey: string;
  collectionAlias: string;
  collectionPrefix: string;
}

const nullableStringField = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const nullableIntField = z
  .number()
  .int()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const optionalNullableStringField = z.string().nullable().optional();
const optionalNullableIntField = z.number().int().nullable().optional();

export const typesenseProductDocumentSchema = z.object({
  id: z.string().uuid(),
  public_id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  short_description: nullableStringField,
  manufacturer_slug: z.string().min(1),
  manufacturer_name: z.string().min(1),
  category_slug: z.string().min(1),
  category_name: z.string().min(1),
  category_path: z.array(z.string()),
  tags: z.array(z.string()),
  compatibility: z.array(z.string()),
  best_price_cents: nullableIntField,
  sell_price_cents: optionalNullableIntField,
  compare_at_cents: optionalNullableIntField,
  discount_pct: optionalNullableIntField,
  currency: z.string().length(3),
  sourcing_vendor_name: optionalNullableStringField,
  in_stock: z.boolean(),
  offer_count: z.number().int().nonnegative(),
  featured: z.boolean(),
  published_at: z.number().int().nonnegative(),
  primary_image_key: nullableStringField,
});

export type TypesenseProductDocument = z.infer<typeof typesenseProductDocumentSchema>;

export const productsCollectionSchema = {
  name: 'products_v2',
  fields: [
    { name: 'public_id', type: 'string' },
    { name: 'slug', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'short_description', type: 'string', optional: true },
    { name: 'manufacturer_slug', type: 'string', facet: true },
    { name: 'manufacturer_name', type: 'string', facet: true },
    { name: 'category_slug', type: 'string', facet: true },
    { name: 'category_name', type: 'string', facet: true },
    { name: 'category_path', type: 'string[]', facet: true },
    { name: 'tags', type: 'string[]', facet: true },
    { name: 'compatibility', type: 'string[]', facet: true },
    { name: 'best_price_cents', type: 'int64', optional: true, sort: true },
    { name: 'sell_price_cents', type: 'int64', optional: true, sort: true },
    { name: 'compare_at_cents', type: 'int64', optional: true },
    { name: 'discount_pct', type: 'int32', optional: true, sort: true },
    { name: 'currency', type: 'string', facet: true },
    { name: 'sourcing_vendor_name', type: 'string', optional: true, facet: true },
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

export function timestampedProductsCollectionName(
  config = getTypesenseConfig(),
  date = new Date()
): string {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  return `${config.collectionPrefix}_v_${timestamp}`;
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

async function parseTypesenseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function createTypesenseProductsCollection(
  collectionName: string,
  config = requireTypesenseConfig()
): Promise<void> {
  const response = await typesenseFetch(
    '/collections',
    {
      method: 'POST',
      body: JSON.stringify({
        ...productsCollectionSchema,
        name: collectionName,
      }),
    },
    config
  );

  if (!response.ok) {
    throw new Error(
      `Typesense collection create failed for ${collectionName}: ${response.status} ${await response.text()}`
    );
  }
}

export async function importTypesenseProducts(
  collectionName: string,
  input: TypesenseProductDocument[],
  config = requireTypesenseConfig()
): Promise<{ indexed: number }> {
  const documents = input.map((document) => typesenseProductDocumentSchema.parse(document));

  if (documents.length === 0) {
    return { indexed: 0 };
  }

  const response = await typesenseFetch(
    `/collections/${encodeURIComponent(collectionName)}/documents/import?action=create`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: documents.map((document) => JSON.stringify(document)).join('\n'),
    },
    config
  );

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Typesense bulk import failed for ${collectionName}: ${response.status} ${body}`
    );
  }

  const failures = body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { success?: boolean; error?: string })
    .filter((result) => result.success === false);

  if (failures.length > 0) {
    throw new Error(
      `Typesense bulk import rejected ${failures.length} product documents for ${collectionName}: ${JSON.stringify(
        failures.slice(0, 5)
      )}`
    );
  }

  return { indexed: documents.length };
}

export async function getTypesenseCollectionDocumentCount(
  collectionNameOrAlias: string,
  config = requireTypesenseConfig()
): Promise<number> {
  const response = await typesenseFetch(
    `/collections/${encodeURIComponent(collectionNameOrAlias)}`,
    { method: 'GET' },
    config
  );

  if (!response.ok) {
    throw new Error(
      `Typesense collection fetch failed for ${collectionNameOrAlias}: ${response.status} ${await response.text()}`
    );
  }

  const body = await parseTypesenseJson<{ num_documents?: number }>(response);
  return body.num_documents ?? 0;
}

export async function getTypesenseAliasTarget(
  aliasName: string,
  config = requireTypesenseConfig()
): Promise<string | null> {
  const response = await typesenseFetch(
    `/aliases/${encodeURIComponent(aliasName)}`,
    { method: 'GET' },
    config
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Typesense alias fetch failed for ${aliasName}: ${response.status} ${await response.text()}`
    );
  }

  const body = await parseTypesenseJson<{ collection_name?: string }>(response);
  return body.collection_name ?? null;
}

export interface TypesenseProductSearchInput {
  q: string;
  page?: number;
  perPage?: number;
  filterBy?: string;
  sortBy?: string;
}

export interface TypesenseProductSearchResult {
  found: number;
  page: number;
  outOf: number;
  facetCounts: unknown[];
  hits: TypesenseProductDocument[];
}

function emptyTypesenseProductSearchResult(
  input: TypesenseProductSearchInput
): TypesenseProductSearchResult {
  return {
    found: 0,
    page: input.page ?? 1,
    outOf: 0,
    facetCounts: [],
    hits: [],
  };
}

export async function searchTypesenseProducts(
  input: TypesenseProductSearchInput,
  config = getTypesenseConfig()
): Promise<TypesenseProductSearchResult> {
  if (!config.apiKey) {
    return emptyTypesenseProductSearchResult(input);
  }

  const params = new URLSearchParams({
    q: input.q.trim() || '*',
    query_by: 'name,short_description,manufacturer_name,category_name,category_slug',
    query_by_weights: '4,2,2,2,1',
    typo_tokens_threshold: '1',
    num_typos: '2',
    page: String(input.page ?? 1),
    per_page: String(input.perPage ?? 24),
    facet_by: 'category_slug,manufacturer_slug,in_stock',
  });

  if (input.filterBy) params.set('filter_by', input.filterBy);
  if (input.sortBy) params.set('sort_by', input.sortBy);

  const response = await typesenseFetch(
    `/collections/${encodeURIComponent(config.collectionAlias)}/documents/search?${params.toString()}`,
    { method: 'GET' },
    config
  );

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404) {
      return emptyTypesenseProductSearchResult(input);
    }

    throw new Error(`Typesense product search failed: ${response.status} ${body}`);
  }

  const body = await parseTypesenseJson<{
    found?: number;
    page?: number;
    out_of?: number;
    facet_counts?: unknown[];
    hits?: Array<{ document?: unknown }>;
  }>(response);

  return {
    found: body.found ?? 0,
    page: body.page ?? input.page ?? 1,
    outOf: body.out_of ?? 0,
    facetCounts: body.facet_counts ?? [],
    hits: (body.hits ?? [])
      .map((hit) => hit.document)
      .filter((document): document is TypesenseProductDocument => Boolean(document))
      .map((document) => typesenseProductDocumentSchema.parse(document)),
  };
}

export async function upsertTypesenseAlias(
  aliasName: string,
  collectionName: string,
  config = requireTypesenseConfig()
): Promise<void> {
  const response = await typesenseFetch(
    `/aliases/${encodeURIComponent(aliasName)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ collection_name: collectionName }),
    },
    config
  );

  if (!response.ok) {
    throw new Error(
      `Typesense alias swap failed for ${aliasName}: ${response.status} ${await response.text()}`
    );
  }
}

export async function deleteTypesenseCollection(
  collectionName: string,
  config = requireTypesenseConfig()
): Promise<void> {
  const response = await typesenseFetch(
    `/collections/${encodeURIComponent(collectionName)}`,
    { method: 'DELETE' },
    config
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Typesense collection delete failed for ${collectionName}: ${response.status} ${await response.text()}`
    );
  }
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
