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

  it('returns an empty search result when search read config has no API key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchTypesenseProducts(
      { q: 'test', page: 1, perPage: 24 },
      { ...config, apiKey: '' }
    );

    expect(result).toEqual({
      found: 0,
      page: 1,
      outOf: 0,
      facetCounts: [],
      hits: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('returns an empty search result when the aliased collection has no documents', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          found: 0,
          out_of: 0,
          page: 1,
          facet_counts: [],
          hits: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchTypesenseProducts({ q: 'test', page: 1, perPage: 24 }, config);

    expect(result).toEqual({
      found: 0,
      page: 1,
      outOf: 0,
      facetCounts: [],
      hits: [],
    });
  });

  it('returns indexed product documents when the alias has matches', async () => {
    const document = {
      id: '94c17a40-95c4-4be2-b246-f0ad66f94b9b',
      public_id: '94c17a40-95c4-4be2-b246-f0ad66f94b9b',
      slug: 'test-product',
      name: 'Test Product',
      manufacturer_slug: 'test-maker',
      manufacturer_name: 'Test Maker',
      category_slug: 'tools',
      category_name: 'Tools',
      category_path: ['tools'],
      tags: [],
      compatibility: [],
      currency: 'USD',
      in_stock: true,
      offer_count: 1,
      featured: false,
      published_at: 1779820000,
    };
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          found: 1,
          out_of: 1,
          page: 1,
          facet_counts: [],
          hits: [{ document }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchTypesenseProducts({ q: 'test', page: 1, perPage: 24 }, config);

    expect(result).toEqual({
      found: 1,
      page: 1,
      outOf: 1,
      facetCounts: [],
      hits: [
        {
          ...document,
          short_description: null,
          best_price_cents: null,
          primary_image_key: null,
        },
      ],
    });
  });
});
