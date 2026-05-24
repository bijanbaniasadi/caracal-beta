-- CreateTable
CREATE TABLE "EcuAnalysisRun" (
    "id" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "indexedFiles" INTEGER NOT NULL DEFAULT 0,
    "unreadableFiles" INTEGER NOT NULL DEFAULT 0,
    "duplicateFiles" INTEGER NOT NULL DEFAULT 0,
    "clusterCount" INTEGER NOT NULL DEFAULT 0,
    "knownFamilyCount" INTEGER NOT NULL DEFAULT 0,
    "unknownFamilyCount" INTEGER NOT NULL DEFAULT 0,
    "oriModPairCount" INTEGER NOT NULL DEFAULT 0,
    "extensionBreakdown" JSONB,
    "summary" JSONB,
    "failedFiles" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuCorpusFile" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "rootPath" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "detectedKind" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAtOnDisk" TIMESTAMP(3),
    "modifiedAtOnDisk" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReadable" BOOLEAN NOT NULL DEFAULT true,
    "readError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuCorpusFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuBinaryFingerprint" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "entropy" DOUBLE PRECISION,
    "entropyProfile" JSONB,
    "architecture" TEXT,
    "supplier" TEXT,
    "probableOem" TEXT,
    "controllerType" TEXT,
    "fuelType" TEXT,
    "softwareVersion" TEXT,
    "hardwareNumber" TEXT,
    "filenameTokens" JSONB,
    "stringTable" JSONB,
    "byteSignatures" JSONB,
    "vectorPatterns" JSONB,
    "calibrationRegions" JSONB,
    "mapBlockCandidates" JSONB,
    "checksumCandidates" JSONB,
    "dtcCandidates" JSONB,
    "intelligenceSummary" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuBinaryFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuFileCluster" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clusterKey" TEXT NOT NULL,
    "clusterType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "familyKey" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuFileCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuFileClusterMember" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcuFileClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuDetectedFamily" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "familyKey" TEXT NOT NULL,
    "familyLabel" TEXT NOT NULL,
    "supplier" TEXT,
    "oem" TEXT,
    "controllerType" TEXT,
    "fuelType" TEXT,
    "architecture" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcuDetectedFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuUnknownFamily" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clusterId" TEXT,
    "unknownKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuUnknownFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuProjectLabel" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "labelType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" BIGINT,
    "dataType" TEXT,
    "unit" TEXT,
    "factor" DOUBLE PRECISION,
    "offset" DOUBLE PRECISION,
    "source" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "comments" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuProjectLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuMapDefinition" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "labelId" TEXT,
    "name" TEXT NOT NULL,
    "address" BIGINT,
    "dataType" TEXT,
    "axes" JSONB,
    "factor" DOUBLE PRECISION,
    "offset" DOUBLE PRECISION,
    "unit" TEXT,
    "comments" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuMapDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuMapRegion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "mapDefinitionId" TEXT,
    "offset" BIGINT,
    "length" INTEGER,
    "regionType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuMapRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuOriModPair" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "originalFileId" TEXT NOT NULL,
    "modifiedFileId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT NOT NULL,
    "shaDistance" DOUBLE PRECISION,
    "changedRegions" JSONB,
    "probableModificationType" TEXT,
    "changedMapCandidates" JSONB,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuOriModPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuModificationSignature" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clusterId" TEXT,
    "pairId" TEXT,
    "signatureType" TEXT NOT NULL,
    "signatureKey" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regions" JSONB,
    "evidence" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuModificationSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuChecksumCandidate" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "offset" BIGINT,
    "length" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuChecksumCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuDtcCandidate" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "offset" BIGINT,
    "length" INTEGER,
    "encoding" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleCodes" JSONB,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuDtcCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcuLearnedSignature" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "clusterId" TEXT,
    "signatureType" TEXT NOT NULL,
    "signatureKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcuLearnedSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcuAnalysisRun_status_idx" ON "EcuAnalysisRun"("status");

-- CreateIndex
CREATE INDEX "EcuAnalysisRun_rootPath_idx" ON "EcuAnalysisRun"("rootPath");

-- CreateIndex
CREATE INDEX "EcuAnalysisRun_startedAt_idx" ON "EcuAnalysisRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EcuCorpusFile_fullPath_key" ON "EcuCorpusFile"("fullPath");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_runId_idx" ON "EcuCorpusFile"("runId");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_sha256_idx" ON "EcuCorpusFile"("sha256");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_extension_idx" ON "EcuCorpusFile"("extension");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_detectedKind_idx" ON "EcuCorpusFile"("detectedKind");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_fileName_idx" ON "EcuCorpusFile"("fileName");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_sizeBytes_idx" ON "EcuCorpusFile"("sizeBytes");

-- CreateIndex
CREATE INDEX "EcuCorpusFile_indexedAt_idx" ON "EcuCorpusFile"("indexedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EcuBinaryFingerprint_fileId_key" ON "EcuBinaryFingerprint"("fileId");

-- CreateIndex
CREATE INDEX "EcuBinaryFingerprint_architecture_idx" ON "EcuBinaryFingerprint"("architecture");

-- CreateIndex
CREATE INDEX "EcuBinaryFingerprint_supplier_idx" ON "EcuBinaryFingerprint"("supplier");

-- CreateIndex
CREATE INDEX "EcuBinaryFingerprint_probableOem_idx" ON "EcuBinaryFingerprint"("probableOem");

-- CreateIndex
CREATE INDEX "EcuFileCluster_clusterType_idx" ON "EcuFileCluster"("clusterType");

-- CreateIndex
CREATE INDEX "EcuFileCluster_familyKey_idx" ON "EcuFileCluster"("familyKey");

-- CreateIndex
CREATE INDEX "EcuFileCluster_confidence_idx" ON "EcuFileCluster"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "EcuFileCluster_runId_clusterKey_key" ON "EcuFileCluster"("runId", "clusterKey");

-- CreateIndex
CREATE INDEX "EcuFileClusterMember_fileId_idx" ON "EcuFileClusterMember"("fileId");

-- CreateIndex
CREATE INDEX "EcuFileClusterMember_score_idx" ON "EcuFileClusterMember"("score");

-- CreateIndex
CREATE UNIQUE INDEX "EcuFileClusterMember_clusterId_fileId_key" ON "EcuFileClusterMember"("clusterId", "fileId");

-- CreateIndex
CREATE INDEX "EcuDetectedFamily_fileId_idx" ON "EcuDetectedFamily"("fileId");

-- CreateIndex
CREATE INDEX "EcuDetectedFamily_familyKey_idx" ON "EcuDetectedFamily"("familyKey");

-- CreateIndex
CREATE INDEX "EcuDetectedFamily_supplier_idx" ON "EcuDetectedFamily"("supplier");

-- CreateIndex
CREATE INDEX "EcuDetectedFamily_oem_idx" ON "EcuDetectedFamily"("oem");

-- CreateIndex
CREATE INDEX "EcuDetectedFamily_confidence_idx" ON "EcuDetectedFamily"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "EcuUnknownFamily_clusterId_key" ON "EcuUnknownFamily"("clusterId");

-- CreateIndex
CREATE INDEX "EcuUnknownFamily_confidence_idx" ON "EcuUnknownFamily"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "EcuUnknownFamily_runId_unknownKey_key" ON "EcuUnknownFamily"("runId", "unknownKey");

-- CreateIndex
CREATE INDEX "EcuProjectLabel_fileId_idx" ON "EcuProjectLabel"("fileId");

-- CreateIndex
CREATE INDEX "EcuProjectLabel_labelType_idx" ON "EcuProjectLabel"("labelType");

-- CreateIndex
CREATE INDEX "EcuProjectLabel_name_idx" ON "EcuProjectLabel"("name");

-- CreateIndex
CREATE INDEX "EcuProjectLabel_address_idx" ON "EcuProjectLabel"("address");

-- CreateIndex
CREATE INDEX "EcuMapDefinition_fileId_idx" ON "EcuMapDefinition"("fileId");

-- CreateIndex
CREATE INDEX "EcuMapDefinition_labelId_idx" ON "EcuMapDefinition"("labelId");

-- CreateIndex
CREATE INDEX "EcuMapDefinition_name_idx" ON "EcuMapDefinition"("name");

-- CreateIndex
CREATE INDEX "EcuMapDefinition_address_idx" ON "EcuMapDefinition"("address");

-- CreateIndex
CREATE INDEX "EcuMapRegion_fileId_idx" ON "EcuMapRegion"("fileId");

-- CreateIndex
CREATE INDEX "EcuMapRegion_mapDefinitionId_idx" ON "EcuMapRegion"("mapDefinitionId");

-- CreateIndex
CREATE INDEX "EcuMapRegion_regionType_idx" ON "EcuMapRegion"("regionType");

-- CreateIndex
CREATE INDEX "EcuMapRegion_offset_idx" ON "EcuMapRegion"("offset");

-- CreateIndex
CREATE INDEX "EcuOriModPair_runId_idx" ON "EcuOriModPair"("runId");

-- CreateIndex
CREATE INDEX "EcuOriModPair_confidence_idx" ON "EcuOriModPair"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "EcuOriModPair_runId_originalFileId_modifiedFileId_key" ON "EcuOriModPair"("runId", "originalFileId", "modifiedFileId");

-- CreateIndex
CREATE INDEX "EcuModificationSignature_runId_idx" ON "EcuModificationSignature"("runId");

-- CreateIndex
CREATE INDEX "EcuModificationSignature_clusterId_idx" ON "EcuModificationSignature"("clusterId");

-- CreateIndex
CREATE INDEX "EcuModificationSignature_pairId_idx" ON "EcuModificationSignature"("pairId");

-- CreateIndex
CREATE INDEX "EcuModificationSignature_signatureType_idx" ON "EcuModificationSignature"("signatureType");

-- CreateIndex
CREATE INDEX "EcuModificationSignature_confidence_idx" ON "EcuModificationSignature"("confidence");

-- CreateIndex
CREATE INDEX "EcuChecksumCandidate_fileId_idx" ON "EcuChecksumCandidate"("fileId");

-- CreateIndex
CREATE INDEX "EcuChecksumCandidate_family_idx" ON "EcuChecksumCandidate"("family");

-- CreateIndex
CREATE INDEX "EcuChecksumCandidate_confidence_idx" ON "EcuChecksumCandidate"("confidence");

-- CreateIndex
CREATE INDEX "EcuDtcCandidate_fileId_idx" ON "EcuDtcCandidate"("fileId");

-- CreateIndex
CREATE INDEX "EcuDtcCandidate_encoding_idx" ON "EcuDtcCandidate"("encoding");

-- CreateIndex
CREATE INDEX "EcuDtcCandidate_confidence_idx" ON "EcuDtcCandidate"("confidence");

-- CreateIndex
CREATE INDEX "EcuLearnedSignature_runId_idx" ON "EcuLearnedSignature"("runId");

-- CreateIndex
CREATE INDEX "EcuLearnedSignature_clusterId_idx" ON "EcuLearnedSignature"("clusterId");

-- CreateIndex
CREATE INDEX "EcuLearnedSignature_signatureType_idx" ON "EcuLearnedSignature"("signatureType");

-- CreateIndex
CREATE INDEX "EcuLearnedSignature_signatureKey_idx" ON "EcuLearnedSignature"("signatureKey");

-- CreateIndex
CREATE INDEX "EcuLearnedSignature_confidence_idx" ON "EcuLearnedSignature"("confidence");

-- AddForeignKey
ALTER TABLE "EcuCorpusFile" ADD CONSTRAINT "EcuCorpusFile_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuBinaryFingerprint" ADD CONSTRAINT "EcuBinaryFingerprint_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuFileCluster" ADD CONSTRAINT "EcuFileCluster_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuFileClusterMember" ADD CONSTRAINT "EcuFileClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "EcuFileCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuFileClusterMember" ADD CONSTRAINT "EcuFileClusterMember_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuDetectedFamily" ADD CONSTRAINT "EcuDetectedFamily_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuUnknownFamily" ADD CONSTRAINT "EcuUnknownFamily_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuUnknownFamily" ADD CONSTRAINT "EcuUnknownFamily_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "EcuFileCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuProjectLabel" ADD CONSTRAINT "EcuProjectLabel_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuMapDefinition" ADD CONSTRAINT "EcuMapDefinition_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuMapDefinition" ADD CONSTRAINT "EcuMapDefinition_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "EcuProjectLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuMapRegion" ADD CONSTRAINT "EcuMapRegion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuMapRegion" ADD CONSTRAINT "EcuMapRegion_mapDefinitionId_fkey" FOREIGN KEY ("mapDefinitionId") REFERENCES "EcuMapDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuOriModPair" ADD CONSTRAINT "EcuOriModPair_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuOriModPair" ADD CONSTRAINT "EcuOriModPair_originalFileId_fkey" FOREIGN KEY ("originalFileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuOriModPair" ADD CONSTRAINT "EcuOriModPair_modifiedFileId_fkey" FOREIGN KEY ("modifiedFileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuModificationSignature" ADD CONSTRAINT "EcuModificationSignature_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuModificationSignature" ADD CONSTRAINT "EcuModificationSignature_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "EcuFileCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuModificationSignature" ADD CONSTRAINT "EcuModificationSignature_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "EcuOriModPair"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuChecksumCandidate" ADD CONSTRAINT "EcuChecksumCandidate_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuDtcCandidate" ADD CONSTRAINT "EcuDtcCandidate_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EcuCorpusFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuLearnedSignature" ADD CONSTRAINT "EcuLearnedSignature_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EcuAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcuLearnedSignature" ADD CONSTRAINT "EcuLearnedSignature_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "EcuFileCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
