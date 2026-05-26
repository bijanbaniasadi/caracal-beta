CREATE TYPE "SupplierSyncMode" AS ENUM ('DRY_RUN', 'STAGE', 'PUBLISH');
CREATE TYPE "SupplierSyncRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "StagingProductStatus" AS ENUM ('PENDING', 'READY', 'APPROVED', 'REJECTED', 'PUBLISHED');

CREATE TABLE "SupplierSource" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "scrapeAllowed" BOOLEAN,
  "robotsSummary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierSyncRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT,
  "mode" "SupplierSyncMode" NOT NULL,
  "status" "SupplierSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  "stagedCount" INTEGER NOT NULL DEFAULT 0,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "publishedCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StagingProduct" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "runId" TEXT,
  "matchedProductId" TEXT,
  "sourceProductKey" TEXT NOT NULL,
  "externalUrl" TEXT NOT NULL,
  "externalSku" TEXT,
  "normalizedSku" TEXT,
  "externalName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "brand" TEXT,
  "categoryName" TEXT,
  "rawPriceCents" INTEGER,
  "rawCurrency" TEXT,
  "convertedPriceCents" INTEGER,
  "salePriceCents" INTEGER,
  "oldPriceCents" INTEGER,
  "discountPercent" INTEGER NOT NULL DEFAULT 10,
  "marginPercent" INTEGER NOT NULL DEFAULT 15,
  "stockStatus" "InventoryStatus" NOT NULL DEFAULT 'IN_STOCK',
  "imageUrl" TEXT,
  "imageApproved" BOOLEAN NOT NULL DEFAULT false,
  "status" "StagingProductStatus" NOT NULL DEFAULT 'PENDING',
  "warnings" JSONB,
  "rejectReasons" JSONB,
  "readyChecklist" JSONB,
  "changedFields" JSONB,
  "rawData" JSONB,
  "normalizedData" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StagingProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierSource_slug_key" ON "SupplierSource"("slug");
CREATE INDEX "SupplierSource_supplierId_idx" ON "SupplierSource"("supplierId");
CREATE INDEX "SupplierSource_isActive_idx" ON "SupplierSource"("isActive");
CREATE INDEX "SupplierSource_createdAt_idx" ON "SupplierSource"("createdAt");

CREATE INDEX "SupplierSyncRun_sourceId_idx" ON "SupplierSyncRun"("sourceId");
CREATE INDEX "SupplierSyncRun_mode_idx" ON "SupplierSyncRun"("mode");
CREATE INDEX "SupplierSyncRun_status_idx" ON "SupplierSyncRun"("status");
CREATE INDEX "SupplierSyncRun_startedAt_idx" ON "SupplierSyncRun"("startedAt");

CREATE UNIQUE INDEX "StagingProduct_sourceId_sourceProductKey_key"
  ON "StagingProduct"("sourceId", "sourceProductKey");
CREATE INDEX "StagingProduct_sourceId_idx" ON "StagingProduct"("sourceId");
CREATE INDEX "StagingProduct_runId_idx" ON "StagingProduct"("runId");
CREATE INDEX "StagingProduct_matchedProductId_idx" ON "StagingProduct"("matchedProductId");
CREATE INDEX "StagingProduct_status_idx" ON "StagingProduct"("status");
CREATE INDEX "StagingProduct_normalizedSku_idx" ON "StagingProduct"("normalizedSku");
CREATE INDEX "StagingProduct_lastSeenAt_idx" ON "StagingProduct"("lastSeenAt");

ALTER TABLE "SupplierSource"
  ADD CONSTRAINT "SupplierSource_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplierSyncRun"
  ADD CONSTRAINT "SupplierSyncRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "SupplierSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StagingProduct"
  ADD CONSTRAINT "StagingProduct_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "SupplierSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StagingProduct"
  ADD CONSTRAINT "StagingProduct_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "SupplierSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StagingProduct"
  ADD CONSTRAINT "StagingProduct_matchedProductId_fkey"
  FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
