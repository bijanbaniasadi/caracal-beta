-- Price intelligence foundation for vendor-product mapping, raw price history,
-- and manually curated public pricing.

CREATE TYPE "VendorCommissionType" AS ENUM ('NONE', 'PERCENT', 'FIXED');
CREATE TYPE "VendorProductMatchStatus" AS ENUM ('UNMAPPED', 'SUGGESTED', 'MATCHED', 'REJECTED');
CREATE TYPE "CuratedPricingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "SupplierSource"
  ADD COLUMN "commissionType" "VendorCommissionType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "commissionRateBps" INTEGER,
  ADD COLUMN "commissionFixedCents" INTEGER,
  ADD COLUMN "reliabilityScore" INTEGER,
  ADD COLUMN "shippingNotes" TEXT;

CREATE TABLE "VendorProduct" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "productId" TEXT,
  "stagingProductId" TEXT,
  "sourceProductKey" TEXT NOT NULL,
  "vendorSku" TEXT,
  "normalizedSku" TEXT,
  "vendorTitle" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "vendorUrl" TEXT NOT NULL,
  "brand" TEXT,
  "categoryName" TEXT,
  "imageUrl" TEXT,
  "matchStatus" "VendorProductMatchStatus" NOT NULL DEFAULT 'UNMAPPED',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VendorProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawPriceHistory" (
  "id" TEXT NOT NULL,
  "vendorProductId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "productId" TEXT,
  "rawPriceCents" INTEGER,
  "rawCurrency" TEXT NOT NULL DEFAULT 'AED',
  "normalizedPriceCents" INTEGER,
  "normalizedCurrency" TEXT NOT NULL DEFAULT 'AED',
  "availability" "InventoryStatus",
  "sourceUrl" TEXT,
  "discountBadge" TEXT,
  "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RawPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CuratedPricing" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "selectedSourceId" TEXT,
  "selectedVendorProductId" TEXT,
  "publicPriceCents" INTEGER,
  "compareAtPriceCents" INTEGER,
  "costBasisCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "marginBps" INTEGER,
  "discountBps" INTEGER,
  "commissionBps" INTEGER,
  "status" "CuratedPricingStatus" NOT NULL DEFAULT 'DRAFT',
  "adminNotes" TEXT,
  "metadata" JSONB,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuratedPricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorProduct_sourceId_sourceProductKey_key"
  ON "VendorProduct"("sourceId", "sourceProductKey");
CREATE UNIQUE INDEX "VendorProduct_sourceId_vendorUrl_key"
  ON "VendorProduct"("sourceId", "vendorUrl");
CREATE INDEX "VendorProduct_sourceId_idx" ON "VendorProduct"("sourceId");
CREATE INDEX "VendorProduct_productId_idx" ON "VendorProduct"("productId");
CREATE INDEX "VendorProduct_stagingProductId_idx" ON "VendorProduct"("stagingProductId");
CREATE INDEX "VendorProduct_matchStatus_idx" ON "VendorProduct"("matchStatus");
CREATE INDEX "VendorProduct_normalizedSku_idx" ON "VendorProduct"("normalizedSku");
CREATE INDEX "VendorProduct_normalizedTitle_idx" ON "VendorProduct"("normalizedTitle");
CREATE INDEX "VendorProduct_lastSeenAt_idx" ON "VendorProduct"("lastSeenAt");
CREATE INDEX "VendorProduct_sourceId_matchStatus_idx" ON "VendorProduct"("sourceId", "matchStatus");
CREATE INDEX "VendorProduct_sourceId_lastSeenAt_idx" ON "VendorProduct"("sourceId", "lastSeenAt");

CREATE INDEX "RawPriceHistory_vendorProductId_idx" ON "RawPriceHistory"("vendorProductId");
CREATE INDEX "RawPriceHistory_sourceId_idx" ON "RawPriceHistory"("sourceId");
CREATE INDEX "RawPriceHistory_productId_idx" ON "RawPriceHistory"("productId");
CREATE INDEX "RawPriceHistory_scrapedAt_idx" ON "RawPriceHistory"("scrapedAt");
CREATE INDEX "RawPriceHistory_vendorProductId_scrapedAt_idx"
  ON "RawPriceHistory"("vendorProductId", "scrapedAt");
CREATE INDEX "RawPriceHistory_productId_scrapedAt_idx"
  ON "RawPriceHistory"("productId", "scrapedAt");
CREATE INDEX "RawPriceHistory_sourceId_scrapedAt_idx"
  ON "RawPriceHistory"("sourceId", "scrapedAt");

CREATE UNIQUE INDEX "CuratedPricing_productId_key" ON "CuratedPricing"("productId");
CREATE INDEX "CuratedPricing_selectedSourceId_idx" ON "CuratedPricing"("selectedSourceId");
CREATE INDEX "CuratedPricing_selectedVendorProductId_idx" ON "CuratedPricing"("selectedVendorProductId");
CREATE INDEX "CuratedPricing_status_idx" ON "CuratedPricing"("status");
CREATE INDEX "CuratedPricing_updatedAt_idx" ON "CuratedPricing"("updatedAt");

CREATE INDEX "SupplierSource_reliabilityScore_idx" ON "SupplierSource"("reliabilityScore");

ALTER TABLE "VendorProduct"
  ADD CONSTRAINT "VendorProduct_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "SupplierSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VendorProduct"
  ADD CONSTRAINT "VendorProduct_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VendorProduct"
  ADD CONSTRAINT "VendorProduct_stagingProductId_fkey"
  FOREIGN KEY ("stagingProductId") REFERENCES "StagingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RawPriceHistory"
  ADD CONSTRAINT "RawPriceHistory_vendorProductId_fkey"
  FOREIGN KEY ("vendorProductId") REFERENCES "VendorProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RawPriceHistory"
  ADD CONSTRAINT "RawPriceHistory_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "SupplierSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RawPriceHistory"
  ADD CONSTRAINT "RawPriceHistory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CuratedPricing"
  ADD CONSTRAINT "CuratedPricing_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CuratedPricing"
  ADD CONSTRAINT "CuratedPricing_selectedSourceId_fkey"
  FOREIGN KEY ("selectedSourceId") REFERENCES "SupplierSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CuratedPricing"
  ADD CONSTRAINT "CuratedPricing_selectedVendorProductId_fkey"
  FOREIGN KEY ("selectedVendorProductId") REFERENCES "VendorProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE VIEW "v_price_intelligence" AS
SELECT
  p."id" AS "productId",
  p."sku" AS "productSku",
  p."name" AS "productName",
  s."id" AS "sourceId",
  s."name" AS "sourceName",
  vp."id" AS "vendorProductId",
  vp."vendorSku",
  vp."vendorTitle",
  vp."vendorUrl",
  latest."normalizedPriceCents" AS "currentMarketPriceCents",
  latest."normalizedCurrency" AS "marketCurrency",
  cp."publicPriceCents" AS "yourCurrentPriceCents",
  cp."currency" AS "yourCurrency",
  latest."normalizedPriceCents" - cp."publicPriceCents" AS "priceDiffCents",
  latest."availability",
  latest."scrapedAt" AS "lastCheckTime"
FROM (
  SELECT DISTINCT ON ("vendorProductId") *
  FROM "RawPriceHistory"
  ORDER BY "vendorProductId", "scrapedAt" DESC, "createdAt" DESC
) latest
JOIN "VendorProduct" vp ON vp."id" = latest."vendorProductId"
JOIN "SupplierSource" s ON s."id" = latest."sourceId"
LEFT JOIN "Product" p ON p."id" = COALESCE(latest."productId", vp."productId")
LEFT JOIN "CuratedPricing" cp ON cp."productId" = p."id";
