import { getPrismaClient } from '@caracal/db';
import type { BinAnalysisStage, StorageProvider } from '@prisma/client';

import { logger } from '../logger.js';
import { toPrismaJson } from '../prisma-json.js';
import { readObject, storeObject } from '../storage.js';
import { analyzeEcuBinary } from './ecu-intelligence.js';
import { extractBinMetadata, hashBinFile } from './metadata.js';

interface ProcessBinAnalysisInput {
  analysisJobId: string;
  uploadId: string;
  attemptNumber: number;
  maxAttempts: number;
  reportProgress?: (progress: number) => Promise<void> | void;
}

async function setStage(
  analysisJobId: string,
  stage: BinAnalysisStage,
  progress: number,
  attemptNumber: number
): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.binAnalysisJob.update({
    where: { id: analysisJobId },
    data: {
      status: 'RUNNING',
      stage,
      progress,
      attempts: attemptNumber,
      ...(stage === 'FILE_HASHING' ? { startedAt: new Date() } : {}),
      failedAt: null,
      errorCode: null,
      errorMessage: null,
      nextRetryAt: null,
    },
    select: { id: true },
  });
}

function resultObjectKey(jobId: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `bin-analysis-results/${date}/${jobId}-${Date.now()}.json`;
}

function retryTimestamp(attemptNumber: number, maxAttempts: number): Date | null {
  if (attemptNumber >= maxAttempts) {
    return null;
  }

  const baseDelay = Number.parseInt(process.env.BIN_ANALYSIS_RETRY_BACKOFF_MS ?? '30000', 10);
  const delayMs = baseDelay * 2 ** Math.max(attemptNumber - 1, 0);
  return new Date(Date.now() + delayMs);
}

export async function markBinAnalysisJobFailed(
  analysisJobId: string,
  error: unknown,
  attemptNumber: number,
  maxAttempts: number
): Promise<void> {
  const prisma = getPrismaClient();
  const message = error instanceof Error ? error.message : 'Unknown BIN analysis failure.';

  await prisma.binAnalysisJob.update({
    where: { id: analysisJobId },
    data: {
      status: 'FAILED',
      stage: 'FAILED',
      attempts: attemptNumber,
      failedAt: new Date(),
      nextRetryAt: retryTimestamp(attemptNumber, maxAttempts),
      errorCode: error instanceof Error ? error.name : 'BIN_ANALYSIS_FAILED',
      errorMessage: message,
    },
    select: { id: true },
  });
}

export async function processBinAnalysisJob(input: ProcessBinAnalysisInput) {
  const prisma = getPrismaClient();
  const report = async (progress: number) => {
    await input.reportProgress?.(progress);
  };

  const job = await prisma.binAnalysisJob.findUnique({
    where: { id: input.analysisJobId },
    include: {
      upload: true,
    },
  });

  if (!job || job.uploadId !== input.uploadId) {
    throw new Error(`Analysis job not found or upload mismatch: ${input.analysisJobId}`);
  }

  if (job.status === 'CANCELLED') {
    logger.info({ analysisJobId: job.id }, 'skipping cancelled BIN analysis job');
    return null;
  }

  await setStage(job.id, 'FILE_HASHING', 10, input.attemptNumber);
  await report(10);

  const storedObject = await readObject({
    key: job.upload.storedObjectKey,
    provider: job.upload.storageProvider,
  });
  const hashes = hashBinFile(storedObject.body);

  if (hashes.sha256 !== job.upload.sha256) {
    throw new Error('Stored BIN SHA-256 does not match upload record.');
  }

  await setStage(job.id, 'MCU_DETECTION', 35, input.attemptNumber);
  await report(35);
  const intelligence = analyzeEcuBinary(storedObject.body, {
    fileName: job.upload.originalFileName,
    productContext: job.upload.productContext,
  });
  const candidates = intelligence.mcu.candidates;
  const primaryCandidate = candidates[0];

  await setStage(job.id, 'METADATA_EXTRACTION', 65, input.attemptNumber);
  await report(65);
  const extractedMetadata = extractBinMetadata(storedObject.body);

  await setStage(job.id, 'RESULT_STORAGE', 85, input.attemptNumber);
  await report(85);
  const summary = {
    pipelineVersion: 'foundation-v1',
    stages: ['FILE_HASHING', 'MCU_DETECTION', 'METADATA_EXTRACTION', 'RESULT_STORAGE'],
    noMapEditingPerformed: true,
    hashes,
    mcuCandidates: candidates,
    metadata: extractedMetadata,
    intelligence,
  };
  const storedResult = await storeObject({
    key: resultObjectKey(job.id),
    body: Buffer.from(JSON.stringify(summary, null, 2)),
    contentType: 'application/json',
  });

  const result = await prisma.$transaction(async (tx) => {
    await tx.binAnalysisResult.deleteMany({
      where: { jobId: job.id },
    });

    const createdResult = await tx.binAnalysisResult.create({
      data: {
        jobId: job.id,
        uploadId: job.uploadId,
        kind: 'PIPELINE_SUMMARY',
        fileSha256: hashes.sha256,
        fileSizeBytes: storedObject.body.length,
        mcuFamily: intelligence.normalizedSummary.primaryMcu?.family ?? primaryCandidate?.family,
        mcuConfidence:
          intelligence.normalizedSummary.primaryMcu?.confidence ?? primaryCandidate?.confidence,
        resultObjectKey: storedResult.key,
        storageProvider: storedResult.provider as StorageProvider,
        summary: toPrismaJson(summary),
        metadata: toPrismaJson({
          upload: {
            originalFileName: job.upload.originalFileName,
            storedObjectKey: job.upload.storedObjectKey,
            storageProvider: job.upload.storageProvider,
          },
          resultStorage: storedResult,
        }),
      },
    });

    await tx.binAnalysisJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        stage: 'COMPLETED',
        progress: 100,
        attempts: input.attemptNumber,
        completedAt: new Date(),
        failedAt: null,
        nextRetryAt: null,
        errorCode: null,
        errorMessage: null,
      },
      select: { id: true },
    });

    return createdResult;
  });

  await report(100);

  return result;
}
