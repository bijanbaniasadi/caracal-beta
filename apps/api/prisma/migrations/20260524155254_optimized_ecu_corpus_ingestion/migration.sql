-- CreateTable
CREATE TABLE "EcuFileHashCache" (
    "id" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "modifiedAtOnDisk" TIMESTAMP(3) NOT NULL,
    "sha256" TEXT NOT NULL,
    "sampledHash" TEXT,
    "lastRunId" TEXT,
    "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuFileHashCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuIngestionCheckpoint" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "rootPath" TEXT NOT NULL,
    "lastPath" TEXT,
    "discoveredFiles" INTEGER NOT NULL DEFAULT 0,
    "skippedFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "failedFiles" INTEGER NOT NULL DEFAULT 0,
    "batchCount" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB,
    "pausedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuIngestionCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuCorpusRelationStage" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fileId" TEXT,
    "fullPath" TEXT,
    "relationType" TEXT NOT NULL,
    "relationKey" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" JSONB,
    "evidenceHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuCorpusRelationStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuCorpusMetric" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcuCorpusMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcuFileHashCache_fullPath_key" ON "EcuFileHashCache"("fullPath");

-- CreateIndex
CREATE INDEX "EcuFileHashCache_sha256_idx" ON "EcuFileHashCache"("sha256");

-- CreateIndex
CREATE INDEX "EcuFileHashCache_lastRunId_idx" ON "EcuFileHashCache"("lastRunId");

-- CreateIndex
CREATE INDEX "EcuFileHashCache_modifiedAtOnDisk_idx" ON "EcuFileHashCache"("modifiedAtOnDisk");

-- CreateIndex
CREATE INDEX "EcuFileHashCache_sizeBytes_idx" ON "EcuFileHashCache"("sizeBytes");

-- CreateIndex
CREATE INDEX "EcuIngestionCheckpoint_stage_status_idx" ON "EcuIngestionCheckpoint"("stage", "status");

-- CreateIndex
CREATE INDEX "EcuIngestionCheckpoint_rootPath_idx" ON "EcuIngestionCheckpoint"("rootPath");

-- CreateIndex
CREATE UNIQUE INDEX "EcuIngestionCheckpoint_runId_stage_key" ON "EcuIngestionCheckpoint"("runId", "stage");

-- CreateIndex
CREATE INDEX "EcuCorpusRelationStage_runId_relationType_idx" ON "EcuCorpusRelationStage"("runId", "relationType");

-- CreateIndex
CREATE INDEX "EcuCorpusRelationStage_runId_status_idx" ON "EcuCorpusRelationStage"("runId", "status");

-- CreateIndex
CREATE INDEX "EcuCorpusRelationStage_relationType_relationKey_idx" ON "EcuCorpusRelationStage"("relationType", "relationKey");

-- CreateIndex
CREATE INDEX "EcuCorpusRelationStage_fileId_idx" ON "EcuCorpusRelationStage"("fileId");

-- CreateIndex
CREATE INDEX "EcuCorpusRelationStage_evidenceHash_idx" ON "EcuCorpusRelationStage"("evidenceHash");

-- CreateIndex
CREATE UNIQUE INDEX "EcuCorpusRelationStage_runId_fileId_relationType_relationKe_key" ON "EcuCorpusRelationStage"("runId", "fileId", "relationType", "relationKey");

-- CreateIndex
CREATE INDEX "EcuCorpusMetric_runId_stage_idx" ON "EcuCorpusMetric"("runId", "stage");

-- CreateIndex
CREATE INDEX "EcuCorpusMetric_metricKey_idx" ON "EcuCorpusMetric"("metricKey");

-- CreateIndex
CREATE INDEX "EcuCorpusMetric_createdAt_idx" ON "EcuCorpusMetric"("createdAt");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_runId_extension_idx" ON "EcuCorpusFile"("runId", "extension");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_runId_detectedKind_idx" ON "EcuCorpusFile"("runId", "detectedKind");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_runId_sha256_idx" ON "EcuCorpusFile"("runId", "sha256");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_runId_indexedAt_idx" ON "EcuCorpusFile"("runId", "indexedAt");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_fullPath_modifiedAtOnDisk_idx" ON "EcuCorpusFile"("fullPath", "modifiedAtOnDisk");

-- AddForeignKey
ALTER TABLE "EcuIngestionCheckpoint" ADD CONSTRAINT "EcuIngestionCheckpoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuCorpusRelationStage" ADD CONSTRAINT "EcuCorpusRelationStage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuCorpusMetric" ADD CONSTRAINT "EcuCorpusMetric_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
