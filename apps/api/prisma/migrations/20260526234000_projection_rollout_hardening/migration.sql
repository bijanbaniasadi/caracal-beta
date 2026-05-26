-- Phase 4B: rollout hardening for public projection contract.
-- Keep public_products as a derived materialized view. This migration removes
-- internal offer metadata from the public projection and adds projection
-- freshness/currency fields needed for rollout validation and search documents.

DROP MATERIALIZED VIEW IF EXISTS public_products;

CREATE MATERIALIZED VIEW public_products AS
SELECT
  mp.public_id,
  mp.slug,
  mp.name,
  mp.short_description,
  mp.long_description_md,
  COALESCE(m.slug, mp.manufacturer_slug) AS manufacturer_slug,
  COALESCE(m.name, mp.manufacturer_name) AS manufacturer_name,
  c.slug AS category_slug,
  c.name AS category_name,
  (
    SELECT json_build_object(
      'storage_key', i.storage_key,
      'alt_text', i.alt_text,
      'width', i.width,
      'height', i.height,
      'mime_type', i.mime_type,
      'is_primary', i.is_primary,
      'sort_order', i.sort_order
    )
    FROM product_images i
    WHERE i.product_id = mp.id AND i.is_primary
    ORDER BY i.sort_order ASC, i.id ASC
    LIMIT 1
  ) AS primary_image,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'storage_key', i.storage_key,
          'alt_text', i.alt_text,
          'width', i.width,
          'height', i.height,
          'mime_type', i.mime_type,
          'is_primary', i.is_primary,
          'sort_order', i.sort_order
        )
        ORDER BY i.is_primary DESC, i.sort_order ASC, i.id ASC
      ),
      '[]'::json
    )
    FROM product_images i
    WHERE i.product_id = mp.id
  ) AS gallery_images,
  (
    SELECT MIN(price_cents)
    FROM vendor_offers vo
    WHERE vo.product_id = mp.id
      AND vo.status = 'active'
      AND vo.in_stock = true
  ) AS best_price_cents,
  COALESCE(
    (
      SELECT cpp.currency
      FROM curated_product_prices cpp
      WHERE cpp.product_id = mp.id
      LIMIT 1
    ),
    (
      SELECT vo.currency
      FROM vendor_offers vo
      WHERE vo.product_id = mp.id
        AND vo.status = 'active'
        AND vo.in_stock = true
        AND vo.price_cents IS NOT NULL
      ORDER BY vo.price_cents ASC, vo.id ASC
      LIMIT 1
    ),
    'USD'
  ) AS price_currency,
  (
    SELECT json_build_object(
      'price_cents', cpp.price_cents,
      'currency', cpp.currency
    )
    FROM curated_product_prices cpp
    WHERE cpp.product_id = mp.id
    LIMIT 1
  ) AS curated_price,
  EXISTS (
    SELECT 1
    FROM vendor_offers vo
    WHERE vo.product_id = mp.id
      AND vo.status = 'active'
      AND vo.in_stock = true
  ) AS in_stock,
  (
    SELECT COUNT(*)::INT
    FROM vendor_offers vo
    WHERE vo.product_id = mp.id
      AND vo.status = 'active'
  ) AS offer_count,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'vendor_name', vs.name,
          'price_cents', vo.price_cents,
          'currency', vo.currency,
          'in_stock', vo.in_stock
        )
        ORDER BY vo.price_cents ASC NULLS LAST, vs.name ASC
      ),
      '[]'::json
    )
    FROM vendor_offers vo
    JOIN vendor_sources vs ON vs.id = vo.vendor_id
    WHERE vo.product_id = mp.id
      AND vo.status = 'active'
  ) AS vendor_offers,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object('key', s.key, 'value', s.value, 'unit', s.unit)
        ORDER BY s.sort_order ASC, s.key ASC
      ),
      '[]'::json
    )
    FROM master_product_specs s
    WHERE s.product_id = mp.id
  ) AS specs,
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'make', mc.make,
          'model', mc.model,
          'year_from', mc.year_from,
          'year_to', mc.year_to,
          'ecu', mc.ecu,
          'notes', mc.notes
        )
        ORDER BY mc.make ASC NULLS LAST, mc.model ASC NULLS LAST, mc.year_from ASC NULLS LAST
      ),
      '[]'::json
    )
    FROM master_product_compatibility mc
    WHERE mc.product_id = mp.id
  ) AS compatibility,
  mp.featured,
  mp.published_at,
  now() AS projected_at
FROM master_products mp
LEFT JOIN manufacturers m ON m.id = mp.manufacturer_id
JOIN categories c ON c.id = mp.category_id
WHERE mp.status = 'published';

CREATE UNIQUE INDEX public_products_public_id_idx ON public_products(public_id);
CREATE UNIQUE INDEX public_products_slug_idx ON public_products(slug);
CREATE INDEX public_products_category_idx ON public_products(category_slug);
CREATE INDEX public_products_manufacturer_idx ON public_products(manufacturer_slug);
CREATE INDEX public_products_projected_at_idx ON public_products(projected_at);

COMMENT ON MATERIALIZED VIEW public_products IS
  'Derived Layer 3 projection. Do not write directly; refreshed only by worker-projection.';
