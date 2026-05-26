import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchTypesenseProducts } from '../src/lib/catalog/typesense.js';

const config = {
  url: 'http://typesense.test',
  apiKey: 'test-key',
  collectionAlias: 'products',
  collectionPrefix: 'products',
};

describe('catalog Typesense empty-index fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty search result when the configured alias is missing', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ message: 'Collection products not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchTypesenseProducts({ q: 'test', page: 2, perPage: 12 }, config);

    expect(result).toEqual({
      found: 0,
      page: 2,
      outOf: 0,
      facetCounts: [],
      hits: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/collections/products/documents/search'
    );
  });
});
