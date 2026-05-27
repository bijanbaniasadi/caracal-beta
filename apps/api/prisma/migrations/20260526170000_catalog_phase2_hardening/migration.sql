-- Phase 2 catalog hardening and review workflow.
-- Additive-only for source tables; the public_products materialized view is
-- dropped/recreated because it is derived state, not source of truth.

CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE TYPE review_action AS ENUM ('create_master', 'attach_to_master', 'reject', 'duplicate');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS manufacturers (
  id BIGSERIAL PRIMARY KEY,
  slug CITEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  logo_image_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  slug CITEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE master_products
  ADD COLUMN IF NOT EXISTS manufacturer_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'master_products_manufacturer_id_fkey'
  ) THEN
    ALTER TABLE master_products
      ADD CONSTRAINT master_products_manufacturer_id_fkey
      FOREIGN KEY (manufacturer_id) REFERENCES manufacturers(id) ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

ALTER TABLE master_products VALIDATE CONSTRAINT master_products_manufacturer_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'manufacturers_logo_image_id_fkey'
  ) THEN
    ALTER TABLE manufacturers
      ADD CONSTRAINT manufacturers_logo_image_id_fkey
      FOREIGN KEY (logo_image_id) REFERENCES product_images(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE manufacturers VALIDATE CONSTRAINT manufacturers_logo_image_id_fkey;

CREATE INDEX IF NOT EXISTS master_products_manufacturer_id_idx ON master_products(manufacturer_id);

ALTER TABLE master_products DROP CONSTRAINT IF EXISTS master_products_sku_key;
DROP INDEX IF EXISTS master_products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS master_products_live_sku_unique
  ON master_products(sku)
  WHERE sku IS NOT NULL AND status <> 'archived';
CREATE INDEX IF NOT EXISTS master_products_sku_idx ON master_products(sku);

CREATE TABLE IF NOT EXISTS master_product_specs (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  key CITEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (product_id, key)
);

CREATE INDEX IF NOT EXISTS master_product_specs_product_sort_idx
  ON master_product_specs(product_id, sort_order);

CREATE TABLE IF NOT EXISTS master_product_tags (
  product_id BIGINT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX IF NOT EXISTS master_product_tags_tag_idx ON master_product_tags(tag_id);

CREATE TABLE IF NOT EXISTS master_product_compatibility (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  make TEXT,
  model TEXT,
  year_from INT,
  year_to INT,
  ecu TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS master_product_compatibility_product_idx
  ON master_product_compatibility(product_id);
CREATE INDEX IF NOT EXISTS master_product_compatibility_make_model_idx
  ON master_product_compatibility(make, model);

CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  offer_id BIGINT NOT NULL REFERENCES vendor_offers(id) ON DELETE CASCADE,
  price_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  in_stock BOOLEAN,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_history_offer_time_idx
  ON price_history(offer_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS review_queue (
  id BIGSERIAL PRIMARY KEY,
  raw_product_id BIGINT NOT NULL UNIQUE REFERENCES vendor_raw_products(id) ON DELETE CASCADE,
  suggested_product_id BIGINT REFERENCES master_products(id) ON DELETE SET NULL,
  suggested_confidence NUMERIC(3,2),
  priority INT NOT NULL DEFAULT 100,
  assigned_to TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  resolved_action review_action,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_queue_open_idx
  ON review_queue(priority, created_at)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS review_queue_suggested_product_idx
  ON review_queue(suggested_product_id);
CREATE INDEX IF NOT EXISTS review_queue_assigned_to_idx
  ON review_queue(assigned_to);

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
    SELECT json_build_object('storage_key', i.storage_key, 'alt_text', i.alt_text)
    FROM product_images i
    WHERE i.product_id = mp.id AND i.is_primary
    LIMIT 1
  ) AS primary_image,
  (
    SELECT MIN(price_cents)
    FROM vendor_offers vo
    WHERE vo.product_id = mp.id
      AND vo.status = 'active'
      AND vo.in_stock = true
  ) AS best_price_cents,
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
  mp.featured,
  mp.published_at
FROM master_products mp
LEFT JOIN manufacturers m ON m.id = mp.manufacturer_id
JOIN categories c ON c.id = mp.category_id
WHERE mp.status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS public_products_public_id_idx ON public_products(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS public_products_slug_idx ON public_products(slug);
CREATE INDEX IF NOT EXISTS public_products_category_idx ON public_products(category_slug);

COMMENT ON MATERIALIZED VIEW public_products IS
  'Derived Layer 3 projection. Do not write directly; refreshed only by worker-projection.';
