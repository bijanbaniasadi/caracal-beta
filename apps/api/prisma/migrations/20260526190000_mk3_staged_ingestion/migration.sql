-- Phase 3A: MK3 single-vendor staged ingestion.
-- Additive-only: seed the MK3 vendor source and add raw-image metadata for
-- private local/object-storage dedupe. No legacy or master catalog data is
-- rewritten.

INSERT INTO vendor_sources (slug, name, base_url, enabled, scrape_cadence, notes)
VALUES (
  'mk3',
  'MK3',
  'https://www.mk3.com',
  true,
  '12 hours',
  'Phase 3A staged ingestion source. Scraper writes raw staging only.'
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  enabled = EXCLUDED.enabled,
  scrape_cadence = EXCLUDED.scrape_cadence,
  notes = EXCLUDED.notes,
  updated_at = now();

ALTER TABLE vendor_raw_images
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS download_error TEXT;

CREATE INDEX IF NOT EXISTS vendor_raw_images_original_url_idx
  ON vendor_raw_images(raw_product_id, original_url);

CREATE INDEX IF NOT EXISTS vendor_raw_images_content_hash_idx
  ON vendor_raw_images(content_hash)
  WHERE content_hash IS NOT NULL;
