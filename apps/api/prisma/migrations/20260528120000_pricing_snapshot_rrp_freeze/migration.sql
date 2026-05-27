-- A3.1 — freeze the manufacturer RRP into the AED compare-at price at publish.
--
-- The public_products matview already reads master_products.compare_at_cents
-- (only when compare_at_currency = 'AED') and derives discount_pct from it, so
-- no matview change is required here. This migration only adds the *source* RRP
-- columns (the curator's RRP in vendor currency, e.g. EUR), which the publish /
-- reprice snapshot converts to AED and freezes into compare_at_cents.
--
-- compare_at_cents / compare_at_currency already exist (added in the A1
-- automatic-pricing migration); this migration does not touch them.

ALTER TABLE master_products
  ADD COLUMN IF NOT EXISTS rrp_source_cents BIGINT,
  ADD COLUMN IF NOT EXISTS rrp_source_currency CHAR(3);
