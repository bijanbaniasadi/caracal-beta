-- CreateEnum
CREATE TYPE "BinAnalysisJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BinAnalysisStage" AS ENUM ('QUEUED', 'FILE_HASHING', 'MCU_DETECTION', 'METADATA_EXTRACTION', 'RESULT_STORAGE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BinAnalysisResultKind" AS ENUM ('PIPELINE_SUMMARY', 'FILE_METADATA', 'MCU_DETECTION');

-- CreateTable
CREATE TABLE "BinAnalysisJob" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "bullJobId" TEXT,
    "status" "BinAnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "BinAnalysisStage" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinAnalysisResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "kind" "BinAnalysisResultKind" NOT NULL DEFAULT 'PIPELINE_SUMMARY',
    "fileSha256" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mcuFamily" TEXT,
    "mcuConfidence" DOUBLE PRECISION,
    "resultObjectKey" TEXT,
    "storageProvider" "StorageProvider",
    "summary" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BinAnalysisJob_bullJobId_key" ON "BinAnalysisJob"("bullJobId");

-- CreateIndex
CREATE INDEX "BinAnalysisJob_uploadId_idx" ON "BinAnalysisJob"("uploadId");

-- CreateIndex
CREATE INDEX "BinAnalysisJob_status_idx" ON "BinAnalysisJob"("status");

-- CreateIndex
CREATE INDEX "BinAnalysisJob_stage_idx" ON "BinAnalysisJob"("stage");

-- CreateIndex
CREATE INDEX "BinAnalysisJob_queueName_idx" ON "BinAnalysisJob"("queueName");

-- CreateIndex
CREATE INDEX "BinAnalysisJob_createdAt_idx" ON "BinAnalysisJob"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BinAnalysisResult_jobId_key" ON "BinAnalysisResult"("jobId");

-- CreateIndex
CREATE INDEX "BinAnalysisResult_uploadId_idx" ON "BinAnalysisResult"("uploadId");

-- CreateIndex
CREATE INDEX "BinAnalysisResult_kind_idx" ON "BinAnalysisResult"("kind");

-- CreateIndex
CREATE INDEX "BinAnalysisResult_fileSha256_idx" ON "BinAnalysisResult"("fileSha256");

-- CreateIndex
CREATE INDEX "BinAnalysisResult_mcuFamily_idx" ON "BinAnalysisResult"("mcuFamily");

-- CreateIndex
CREATE INDEX "BinAnalysisResult_createdAt_idx" ON "BinAnalysisResult"("createdAt");

-- AddForeignKey
ALTER TABLE "BinAnalysisJob" ADD CONSTRAINT "BinAnalysisJob_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "BinUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinAnalysisResult" ADD CONSTRAINT "BinAnalysisResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BinAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinAnalysisResult" ADD CONSTRAINT "BinAnalysisResult_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "BinUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
