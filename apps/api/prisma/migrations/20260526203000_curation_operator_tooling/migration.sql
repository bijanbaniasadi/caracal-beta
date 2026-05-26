-- Phase 3B: admin curation workflow and operator tooling.
-- Additive-only. This does not publish products, change frontend reads, or
-- modify the public_products projection.

DO $$
BEGIN
  ALTER TYPE review_action ADD VALUE IF NOT EXISTS 'archive';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS curated_product_prices (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE REFERENCES master_products(id) ON DELETE CASCADE,
  selected_offer_id BIGINT REFERENCES vendor_offers(id) ON DELETE SET NULL,
  price_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  reason TEXT,
  selected_by TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS curated_product_prices_offer_idx
  ON curated_product_prices(selected_offer_id);
CREATE INDEX IF NOT EXISTS curated_product_prices_selected_by_idx
  ON curated_product_prices(selected_by);
CREATE INDEX IF NOT EXISTS curated_product_prices_selected_at_idx
  ON curated_product_prices(selected_at DESC);

COMMENT ON TABLE curated_product_prices IS
  'Layer 2 admin-selected pricing record. Not used by public_products until a future explicit projection change.';
