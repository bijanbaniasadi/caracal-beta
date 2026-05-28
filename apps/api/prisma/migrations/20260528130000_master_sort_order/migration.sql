-- Add a curated sort_order column to master_products so the public catalog can
-- display products in a deliberate sequence instead of being driven by the
-- microsecond ordering of import / publish timestamps.
--
-- The public_products matview already exposes the master via public_id, so the
-- /api/catalog/products browse route can LEFT JOIN master_products on public_id
-- and ORDER BY mp.sort_order without recreating the matview.

ALTER TABLE master_products
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS master_products_sort_order_idx
  ON master_products(sort_order);
