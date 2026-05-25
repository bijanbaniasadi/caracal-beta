-- CreateEnum
CREATE TYPE "EcuPatcherAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EcuPatcherModule" AS ENUM ('DCM71B_DPF', 'DCM71B_EGR', 'SID208_DPF_EGR', 'DTC_REMOVER');

-- CreateEnum
CREATE TYPE "EcuPatcherJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "EcuPatcherAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EcuPatcherAccessStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL DEFAULT 120000,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "notes" TEXT,
    "adminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuPatcherAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuPatcherJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadId" TEXT,
    "module" "EcuPatcherModule" NOT NULL,
    "status" "EcuPatcherJobStatus" NOT NULL DEFAULT 'QUEUED',
    "originalFileName" TEXT NOT NULL,
    "originalByteSize" INTEGER NOT NULL,
    "originalSha256" TEXT NOT NULL,
    "resultFileName" TEXT,
    "resultObjectKey" TEXT,
    "resultStorageProvider" "StorageProvider",
    "resultByteSize" INTEGER,
    "resultSha256" TEXT,
    "patchesTotal" INTEGER NOT NULL DEFAULT 0,
    "patchesReady" INTEGER NOT NULL DEFAULT 0,
    "patchesApplied" INTEGER NOT NULL DEFAULT 0,
    "patchesAlreadyApplied" INTEGER NOT NULL DEFAULT 0,
    "patchesMismatched" INTEGER NOT NULL DEFAULT 0,
    "checksumApplied" BOOLEAN NOT NULL DEFAULT false,
    "checksumOffset" INTEGER,
    "checksumValue" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "logs" JSONB,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuPatcherJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcuPatcherAccess_userId_key" ON "EcuPatcherAccess"("userId");

-- CreateIndex
CREATE INDEX "EcuPatcherAccess_status_idx" ON "EcuPatcherAccess"("status");

-- CreateIndex
CREATE INDEX "EcuPatcherAccess_adminId_idx" ON "EcuPatcherAccess"("adminId");

-- CreateIndex
CREATE INDEX "EcuPatcherAccess_createdAt_idx" ON "EcuPatcherAccess"("createdAt");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_userId_idx" ON "EcuPatcherJob"("userId");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_uploadId_idx" ON "EcuPatcherJob"("uploadId");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_module_idx" ON "EcuPatcherJob"("module");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_status_idx" ON "EcuPatcherJob"("status");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_originalSha256_idx" ON "EcuPatcherJob"("originalSha256");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_resultSha256_idx" ON "EcuPatcherJob"("resultSha256");

-- CreateIndex
CREATE INDEX "EcuPatcherJob_createdAt_idx" ON "EcuPatcherJob"("createdAt");

-- AddForeignKey
ALTER TABLE "EcuPatcherAccess" ADD CONSTRAINT "EcuPatcherAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuPatcherJob" ADD CONSTRAINT "EcuPatcherJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuPatcherJob" ADD CONSTRAINT "EcuPatcherJob_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "BinUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
