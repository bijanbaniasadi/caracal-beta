-- Catalog role separation groundwork.
-- This file is intentionally not executed by Prisma migrations. Apply it during
-- an ops-controlled role rollout after production credentials are split.

-- Expected roles:
--   caracal_api
--   caracal_worker_ingestion
--   caracal_worker_fingerprint
--   caracal_worker_image_pipeline
--   caracal_worker_projection

GRANT SELECT, INSERT, UPDATE ON master_products, vendor_offers, product_images TO caracal_api;
GRANT SELECT, INSERT ON admin_audit_log TO caracal_api;
GRANT SELECT ON categories, manufacturers, tags, master_product_specs,
  master_product_tags, master_product_compatibility, public_products TO caracal_api;
GRANT SELECT, INSERT, UPDATE ON review_queue TO caracal_api;

GRANT SELECT, INSERT ON ingestion_runs, vendor_raw_products, vendor_raw_images
  TO caracal_worker_ingestion;
GRANT SELECT ON vendor_sources TO caracal_worker_ingestion;

GRANT SELECT, UPDATE ON vendor_raw_products TO caracal_worker_fingerprint;
GRANT SELECT, INSERT, UPDATE ON vendor_offers, price_history, review_queue
  TO caracal_worker_fingerprint;
GRANT SELECT ON master_products, vendor_sources TO caracal_worker_fingerprint;

GRANT SELECT, UPDATE ON vendor_raw_images TO caracal_worker_image_pipeline;
GRANT SELECT, INSERT ON product_images TO caracal_worker_image_pipeline;
GRANT SELECT ON vendor_sources TO caracal_worker_image_pipeline;

GRANT SELECT ON master_products, vendor_offers, product_images, categories,
  manufacturers, tags, master_product_specs, master_product_tags,
  master_product_compatibility, public_products TO caracal_worker_projection;

-- Projection refresh still requires ownership or an explicit SECURITY DEFINER
-- function in a later ops migration. Keep this as groundwork until roles exist.
