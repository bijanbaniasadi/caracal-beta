-- A1 automatic pricing engine.
-- Source tables are additive-only. public_products is a derived matview and is
-- recreated here to add AED sell-price projection fields.

CREATE TABLE IF NOT EXISTS catalog_pricing_policies (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'vendor')),
  vendor_id BIGINT REFERENCES vendor_sources(id) ON DELETE CASCADE,
  margin_bps INTEGER NOT NULL DEFAULT 1500 CHECK (margin_bps >= 0),
  rounding_increment_cents BIGINT NOT NULL DEFAULT 1000 CHECK (rounding_increment_cents > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'global' AND vendor_id IS NULL)
    OR
    (scope = 'vendor' AND vendor_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_pricing_policies_global_idx
  ON catalog_pricing_policies ((scope))
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS catalog_pricing_policies_vendor_idx
  ON catalog_pricing_policies (vendor_id)
  WHERE scope = 'vendor';

INSERT INTO catalog_pricing_policies (
  scope,
  vendor_id,
  margin_bps,
  rounding_increment_cents,
  enabled
)
VALUES ('global', NULL, 1500, 1000, true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS currency_rates (
  currency CHAR(3) PRIMARY KEY,
  base_currency CHAR(3) NOT NULL DEFAULT 'AED',
  rate_to_aed NUMERIC(18, 6) NOT NULL CHECK (rate_to_aed > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (base_currency = 'AED')
);

INSERT INTO currency_rates (currency, base_currency, rate_to_aed)
VALUES
  ('AED', 'AED', 1.000000),
  ('USD', 'AED', 3.672500),
  ('EUR', 'AED', 4.000000),
  ('GBP', 'AED', 4.650000)
ON CONFLICT (currency) DO NOTHING;

ALTER TABLE vendor_raw_products
  ADD COLUMN IF NOT EXISTS rrp_cents BIGINT,
  ADD COLUMN IF NOT EXISTS rrp_currency CHAR(3);

ALTER TABLE master_products
  ADD COLUMN IF NOT EXISTS compare_at_cents BIGINT,
  ADD COLUMN IF NOT EXISTS compare_at_currency CHAR(3);

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
  computed_price.sell_price_cents,
  CASE
    WHEN mp.compare_at_cents IS NOT NULL
      AND COALESCE(mp.compare_at_currency, 'AED') = 'AED'
      AND computed_price.sell_price_cents IS NOT NULL
      AND mp.compare_at_cents > computed_price.sell_price_cents
    THEN mp.compare_at_cents
    ELSE NULL
  END AS compare_at_cents,
  CASE
    WHEN mp.compare_at_cents IS NOT NULL
      AND COALESCE(mp.compare_at_currency, 'AED') = 'AED'
      AND computed_price.sell_price_cents IS NOT NULL
      AND mp.compare_at_cents > computed_price.sell_price_cents
    THEN 'AED'
    ELSE NULL
  END AS compare_at_currency,
  CASE
    WHEN mp.compare_at_cents IS NOT NULL
      AND COALESCE(mp.compare_at_currency, 'AED') = 'AED'
      AND computed_price.sell_price_cents IS NOT NULL
      AND mp.compare_at_cents > computed_price.sell_price_cents
    THEN FLOOR(
      ((mp.compare_at_cents - computed_price.sell_price_cents)::numeric * 100)
      / mp.compare_at_cents
    )::INT
    ELSE NULL
  END AS discount_pct,
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
  lowest_priced_offer.vendor_name AS sourcing_vendor_name,
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
LEFT JOIN LATERAL (
  SELECT
    vo.vendor_id,
    ROUND(vo.price_cents::numeric * cr.rate_to_aed, 0)::BIGINT AS cost_aed_cents,
    vs.name AS vendor_name
  FROM vendor_offers vo
  JOIN vendor_sources vs ON vs.id = vo.vendor_id
  JOIN currency_rates cr
    ON cr.currency = UPPER(vo.currency)::CHAR(3)
   AND cr.base_currency = 'AED'
  WHERE vo.product_id = mp.id
    AND vo.status = 'active'
    AND vo.in_stock = true
    AND vo.price_cents IS NOT NULL
  ORDER BY (vo.price_cents::numeric * cr.rate_to_aed) ASC, vo.id ASC
  LIMIT 1
) lowest_priced_offer ON true
LEFT JOIN LATERAL (
  SELECT
    COALESCE(vendor_policy.margin_bps, global_policy.margin_bps, 1500) AS margin_bps,
    COALESCE(
      vendor_policy.rounding_increment_cents,
      global_policy.rounding_increment_cents,
      1000
    ) AS rounding_increment_cents
  FROM (SELECT 1) seed
  LEFT JOIN catalog_pricing_policies global_policy
    ON global_policy.scope = 'global'
   AND global_policy.vendor_id IS NULL
   AND global_policy.enabled = true
  LEFT JOIN catalog_pricing_policies vendor_policy
    ON vendor_policy.scope = 'vendor'
   AND vendor_policy.vendor_id = lowest_priced_offer.vendor_id
   AND vendor_policy.enabled = true
) pricing_policy ON true
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN lowest_priced_offer.cost_aed_cents IS NULL THEN NULL
      ELSE (
        CEIL(
          (
            lowest_priced_offer.cost_aed_cents::numeric
            * (10000 + pricing_policy.margin_bps)
            / 10000
          )
          / pricing_policy.rounding_increment_cents
        )
        * pricing_policy.rounding_increment_cents
      )::BIGINT
    END AS sell_price_cents
) computed_price ON true
WHERE mp.status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS public_products_public_id_idx ON public_products(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS public_products_slug_idx ON public_products(slug);
CREATE INDEX IF NOT EXISTS public_products_category_idx ON public_products(category_slug);
CREATE INDEX IF NOT EXISTS public_products_manufacturer_idx ON public_products(manufacturer_slug);
CREATE INDEX IF NOT EXISTS public_products_projected_at_idx ON public_products(projected_at);

COMMENT ON MATERIALIZED VIEW public_products IS
  'Derived Layer 3 projection. Do not write directly; refreshed only by worker-projection.';
