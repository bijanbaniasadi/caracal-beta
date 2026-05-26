-- Catalog approval audit trail for supplier catalog staging decisions.
CREATE TABLE "CatalogApprovalLog" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT,
  "stagingProductId" TEXT,
  "stagingRowId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CatalogApprovalLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogApprovalLog_adminUserId_idx" ON "CatalogApprovalLog"("adminUserId");
CREATE INDEX "CatalogApprovalLog_stagingProductId_idx" ON "CatalogApprovalLog"("stagingProductId");
CREATE INDEX "CatalogApprovalLog_stagingRowId_idx" ON "CatalogApprovalLog"("stagingRowId");
CREATE INDEX "CatalogApprovalLog_action_idx" ON "CatalogApprovalLog"("action");
CREATE INDEX "CatalogApprovalLog_createdAt_idx" ON "CatalogApprovalLog"("createdAt");

ALTER TABLE "CatalogApprovalLog"
  ADD CONSTRAINT "CatalogApprovalLog_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CatalogApprovalLog"
  ADD CONSTRAINT "CatalogApprovalLog_stagingProductId_fkey"
  FOREIGN KEY ("stagingProductId") REFERENCES "StagingProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
