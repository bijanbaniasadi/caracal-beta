-- Backend feature intake models: uploads, quote requests, product inquiries,
-- workshop consultation leads, and audit logs.

CREATE TYPE "IntakeStatus" AS ENUM ('NEW', 'IN_REVIEW', 'RESPONDED', 'CLOSED', 'SPAM');
CREATE TYPE "BinUploadStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'REJECTED', 'STORED');
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'R2');
CREATE TYPE "AuditActorType" AS ENUM ('ANONYMOUS', 'USER', 'SYSTEM');

CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "companyName" TEXT,
    "workshopName" TEXT,
    "vehicleDetails" TEXT,
    "requestedItems" JSONB,
    "message" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'api',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BinUpload" (
    "id" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedObjectKey" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "BinUploadStatus" NOT NULL DEFAULT 'RECEIVED',
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "productContext" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "quoteRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductInquiry" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "productId" TEXT,
    "productSku" TEXT,
    "productName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "companyName" TEXT,
    "quantity" INTEGER,
    "message" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'api',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkshopConsultationLead" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "workshopName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "location" TEXT,
    "monthlyVolume" INTEGER,
    "serviceInterests" JSONB,
    "preferredTimeline" TEXT,
    "message" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'api',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopConsultationLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'ANONYMOUS',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteRequest_referenceCode_key" ON "QuoteRequest"("referenceCode");
CREATE INDEX "QuoteRequest_customerEmail_idx" ON "QuoteRequest"("customerEmail");
CREATE INDEX "QuoteRequest_status_idx" ON "QuoteRequest"("status");
CREATE INDEX "QuoteRequest_createdAt_idx" ON "QuoteRequest"("createdAt");

CREATE UNIQUE INDEX "BinUpload_storedObjectKey_key" ON "BinUpload"("storedObjectKey");
CREATE INDEX "BinUpload_sha256_idx" ON "BinUpload"("sha256");
CREATE INDEX "BinUpload_requesterEmail_idx" ON "BinUpload"("requesterEmail");
CREATE INDEX "BinUpload_quoteRequestId_idx" ON "BinUpload"("quoteRequestId");
CREATE INDEX "BinUpload_createdAt_idx" ON "BinUpload"("createdAt");

CREATE UNIQUE INDEX "ProductInquiry_referenceCode_key" ON "ProductInquiry"("referenceCode");
CREATE INDEX "ProductInquiry_customerEmail_idx" ON "ProductInquiry"("customerEmail");
CREATE INDEX "ProductInquiry_productSku_idx" ON "ProductInquiry"("productSku");
CREATE INDEX "ProductInquiry_status_idx" ON "ProductInquiry"("status");
CREATE INDEX "ProductInquiry_createdAt_idx" ON "ProductInquiry"("createdAt");

CREATE UNIQUE INDEX "WorkshopConsultationLead_referenceCode_key" ON "WorkshopConsultationLead"("referenceCode");
CREATE INDEX "WorkshopConsultationLead_contactEmail_idx" ON "WorkshopConsultationLead"("contactEmail");
CREATE INDEX "WorkshopConsultationLead_status_idx" ON "WorkshopConsultationLead"("status");
CREATE INDEX "WorkshopConsultationLead_createdAt_idx" ON "WorkshopConsultationLead"("createdAt");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "BinUpload"
ADD CONSTRAINT "BinUpload_quoteRequestId_fkey"
FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
