-- Optimized read paths for the 10k+ legacy shop catalog.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_status_categoryId_name_id_idx"
  ON "Product"("status", "categoryId", "name", "id");

CREATE INDEX IF NOT EXISTS "Product_status_name_id_idx"
  ON "Product"("status", "name", "id");

CREATE INDEX IF NOT EXISTS "Product_status_priceCents_id_idx"
  ON "Product"("status", "priceCents", "id");

CREATE INDEX IF NOT EXISTS "Product_status_isFeatured_name_id_idx"
  ON "Product"("status", "isFeatured", "name", "id");

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_sku_trgm_idx"
  ON "Product" USING GIN ("sku" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_shortDescription_trgm_idx"
  ON "Product" USING GIN ("shortDescription" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Category_isActive_parentId_sortOrder_name_idx"
  ON "Category"("isActive", "parentId", "sortOrder", "name");
