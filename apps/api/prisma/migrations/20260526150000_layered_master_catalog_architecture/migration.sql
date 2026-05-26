-- Phase 1 layered master catalog architecture.
-- This migration only creates the new three-layer catalog family. Legacy catalog
-- tables are intentionally left untouched.

CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE TYPE product_status AS ENUM ('draft', 'pending_review', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ingestion_status AS ENUM ('running', 'completed', 'failed', 'partial');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE raw_match_status AS ENUM ('unmatched', 'auto_matched', 'admin_matched', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE offer_status AS ENUM ('active', 'paused', 'discontinued');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vendor_sources (
  id BIGSERIAL PRIMARY KEY,
  slug CITEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  scrape_cadence TEXT NOT NULL DEFAULT '24 hours',
  last_scraped_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  slug CITEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_root_slug_unique
  ON categories(slug)
  WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS categories_parent_idx ON categories(parent_id);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  vendor_id BIGINT NOT NULL REFERENCES vendor_sources(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status ingestion_status NOT NULL DEFAULT 'running',
  pages_scraped INT NOT NULL DEFAULT 0,
  products_found INT NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggered_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ingestion_runs_vendor_idx ON ingestion_runs(vendor_id);
CREATE INDEX IF NOT EXISTS ingestion_runs_status_idx ON ingestion_runs(status);
CREATE INDEX IF NOT EXISTS ingestion_runs_started_idx ON ingestion_runs(started_at);

CREATE TABLE IF NOT EXISTS master_products (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  slug CITEXT NOT NULL UNIQUE,
  sku CITEXT UNIQUE,
  mpn CITEXT,
  name TEXT NOT NULL,
  short_description TEXT,
  long_description_md TEXT,
  manufacturer_slug CITEXT NOT NULL,
  manufacturer_name TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  status product_status NOT NULL DEFAULT 'draft',
  fingerprint TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  seo_title TEXT,
  seo_description TEXT,
  created_by TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  updated_by TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_products_status_idx
  ON master_products(status)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS master_products_category_idx ON master_products(category_id);
CREATE INDEX IF NOT EXISTS master_products_manufacturer_idx ON master_products(manufacturer_slug);
CREATE INDEX IF NOT EXISTS master_products_fingerprint_idx ON master_products(fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS master_products_live_fingerprint_unique
  ON master_products(fingerprint)
  WHERE status <> 'archived';

CREATE TABLE IF NOT EXISTS vendor_raw_products (
  id BIGSERIAL PRIMARY KEY,
  ingestion_run_id BIGINT NOT NULL REFERENCES ingestion_runs(id) ON DELETE RESTRICT,
  vendor_id BIGINT NOT NULL REFERENCES vendor_sources(id) ON DELETE RESTRICT,
  vendor_url TEXT NOT NULL,
  vendor_sku TEXT,
  raw_name TEXT,
  raw_description TEXT,
  raw_price_text TEXT,
  parsed_price_cents BIGINT,
  parsed_currency CHAR(3),
  parsed_in_stock BOOLEAN,
  raw_specs JSONB,
  raw_image_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  raw_html_storage_key TEXT,
  fingerprint TEXT NOT NULL,
  matched_product_id BIGINT REFERENCES master_products(id) ON DELETE SET NULL,
  match_status raw_match_status NOT NULL DEFAULT 'unmatched',
  match_confidence NUMERIC(3,2),
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ingestion_run_id, vendor_id, vendor_url)
);

CREATE INDEX IF NOT EXISTS vendor_raw_products_run_idx ON vendor_raw_products(ingestion_run_id);
CREATE INDEX IF NOT EXISTS vendor_raw_products_vendor_idx ON vendor_raw_products(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_raw_products_fp_idx ON vendor_raw_products(fingerprint);
CREATE INDEX IF NOT EXISTS vendor_raw_products_match_idx ON vendor_raw_products(match_status);
CREATE INDEX IF NOT EXISTS vendor_raw_products_matched_product_idx ON vendor_raw_products(matched_product_id);

CREATE TABLE IF NOT EXISTS vendor_raw_images (
  id BIGSERIAL PRIMARY KEY,
  raw_product_id BIGINT NOT NULL REFERENCES vendor_raw_products(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  storage_key TEXT,
  bytes INT,
  width INT,
  height INT,
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_raw_images_raw_product_idx ON vendor_raw_images(raw_product_id);

CREATE TABLE IF NOT EXISTS vendor_offers (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  vendor_id BIGINT NOT NULL REFERENCES vendor_sources(id) ON DELETE RESTRICT,
  vendor_sku TEXT,
  vendor_url TEXT NOT NULL,
  price_cents BIGINT,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  in_stock BOOLEAN,
  last_seen_at TIMESTAMPTZ NOT NULL,
  status offer_status NOT NULL DEFAULT 'active',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, vendor_url)
);

CREATE INDEX IF NOT EXISTS vendor_offers_product_idx ON vendor_offers(product_id);
CREATE INDEX IF NOT EXISTS vendor_offers_vendor_idx ON vendor_offers(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_offers_status_idx ON vendor_offers(status);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  width INT,
  height INT,
  mime_type TEXT,
  alt_text TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  source_vendor_id BIGINT REFERENCES vendor_sources(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_images_product_sort_idx ON product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS product_images_source_vendor_idx ON product_images(source_vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_image
  ON product_images(product_id)
  WHERE is_primary;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  diff JSONB,
  request_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_entity_idx
  ON admin_audit_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_user_idx ON admin_audit_log(user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public_products AS
SELECT
  mp.public_id,
  mp.slug,
  mp.name,
  mp.short_description,
  mp.long_description_md,
  mp.manufacturer_slug,
  mp.manufacturer_name,
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
JOIN categories c ON c.id = mp.category_id
WHERE mp.status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS public_products_public_id_idx ON public_products(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS public_products_slug_idx ON public_products(slug);
CREATE INDEX IF NOT EXISTS public_products_category_idx ON public_products(category_slug);
