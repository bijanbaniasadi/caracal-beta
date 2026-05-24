import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { getPrismaClient } from '@caracal/db';
import { Prisma } from '@prisma/client';

import { withDbRetry } from '../observability/db-retry.js';
import { recordStageMetrics } from '../observability/metrics.js';
import { toPrismaJson } from '../prisma-json.js';
import {
  classifyKnownFamilies,
  extractVersionHints,
  inferControllerType,
  inferFuelType,
  inferProbableOem,
  type CorpusFamilyDetection,
} from './classifiers.js';
import {
  detectFileKind,
  fingerprintCorpusFile,
  sha256File,
  type PrintableStringMatch,
} from './fingerprint.js';
import { extractProjectLabels } from './label-extraction.js';
import { sizeBucket, stableKey, toJsonSafe } from './serialization.js';

const defaultCorpusRoot = 'C:\\Users\\Bijan\\Desktop\\SAFE\\Damos and files';
const optimizedMode = 'optimized-v1';

export type EcuIngestionStage =
  | 'discovery'
  | 'fingerprinting'
  | 'clustering'
  | 'relation-extraction'
  | 'signature-generation';

export interface OptimizedIngestionInput {
  rootPath?: string;
  runId?: string;
  maxFiles?: number;
  batchSize?: number;
  fingerprintBatchSize?: number;
  maxAnalysisBytes?: number;
  resume?: boolean;
}

export interface OptimizedStageResult {
  runId: string;
  stage: EcuIngestionStage;
  processedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  elapsedMs: number;
  filesPerSecond: number;
  memoryUsage: NodeJS.MemoryUsage;
}

interface DiscoveryCandidate {
  fullPath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  detectedKind: string;
  sizeBytes: bigint;
  createdAtOnDisk: Date;
  modifiedAtOnDisk: Date;
}

interface ChangedDiscoveryFile extends DiscoveryCandidate {
  id: string;
  runId: string;
  rootPath: string;
  sha256: string;
  sampledHash: string | null;
}

interface FingerprintFeature {
  fileId: string;
  fullPath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: bigint;
  filenameTokens: string[];
  strings: string[];
  stringMatches: PrintableStringMatch[];
  byteSignatures: Array<{ offset: number; hex: string }>;
  labelNames: string[];
  detections: CorpusFamilyDetection[];
  architecture?: string | null;
  supplier?: string | null;
  probableOem?: string | null;
  controllerType?: string | null;
  fuelType?: string | null;
  softwareVersion?: string;
  hardwareNumber?: string;
  entropy: number;
  entropyProfile: unknown;
  vectorPatterns: unknown;
  calibrationRegions: unknown;
  mapBlockCandidates: unknown;
  checksumCandidates: unknown;
  dtcCandidates: unknown;
  intelligenceSummary: unknown;
  projectMetadata: unknown;
}

interface RelationStageFeature {
  fileId: string;
  fullPath: string;
  filenameTokens: string[];
  labelNames: string[];
  byteSignatures: Array<{ offset: number; hex: string }>;
  detections: CorpusFamilyDetection[];
}

function envNumber(name: string, fallback: number): number {
  return Number.parseInt(process.env[name] ?? String(fallback), 10);
}

function maxAnalysisBytes(input?: OptimizedIngestionInput): number {
  return input?.maxAnalysisBytes ?? envNumber('ECU_CORPUS_MAX_ANALYSIS_BYTES', 256 * 1024);
}

function discoveryBatchSize(input?: OptimizedIngestionInput): number {
  return input?.batchSize ?? envNumber('ECU_CORPUS_DISCOVERY_BATCH_SIZE', 1000);
}

function fingerprintBatchSize(input?: OptimizedIngestionInput): number {
  return input?.fingerprintBatchSize ?? envNumber('ECU_CORPUS_FINGERPRINT_BATCH_SIZE', 100);
}

function filesPerSecond(processed: number, elapsedMs: number): number {
  return Number((processed / Math.max(elapsedMs / 1000, 0.001)).toFixed(2));
}

function stageResult(input: {
  runId: string;
  stage: EcuIngestionStage;
  processedFiles: number;
  skippedFiles?: number;
  failedFiles?: number;
  elapsedMs: number;
  filesPerSecond: number;
}): OptimizedStageResult {
  recordStageMetrics({
    stage: input.stage,
    status: 'success',
    elapsedMs: input.elapsedMs,
    processedFiles: input.processedFiles,
    skippedFiles: input.skippedFiles,
    failedFiles: input.failedFiles,
    filesPerSecond: input.filesPerSecond,
  });

  return {
    runId: input.runId,
    stage: input.stage,
    processedFiles: input.processedFiles,
    skippedFiles: input.skippedFiles ?? 0,
    failedFiles: input.failedFiles ?? 0,
    elapsedMs: input.elapsedMs,
    filesPerSecond: input.filesPerSecond,
    memoryUsage: process.memoryUsage(),
  };
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

function sampledHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function jsonb(value: unknown): Prisma.Sql {
  if (value === undefined || value === null) {
    return Prisma.sql`NULL`;
  }

  return Prisma.sql`CAST(${JSON.stringify(value)} AS jsonb)`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }

  return chunks;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function byteSignatureArray(value: unknown): Array<{ offset: number; hex: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { offset?: unknown }).offset === 'number' &&
      typeof (item as { hex?: unknown }).hex === 'string'
    ) {
      return [{ offset: (item as { offset: number }).offset, hex: (item as { hex: string }).hex }];
    }

    return [];
  });
}

async function* walkFiles(rootPath: string): AsyncGenerator<string> {
  const entries = (await readdir(rootPath, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name)
  );

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function createOrResumeRun(input: OptimizedIngestionInput) {
  const prisma = getPrismaClient();
  const rootPath = path.resolve(input.rootPath ?? process.env.ECU_CORPUS_ROOT ?? defaultCorpusRoot);

  if (input.runId) {
    return withDbRetry('ecu_analysis_run_resume', () =>
      prisma.ecuAnalysisRun.update({
        where: { id: input.runId },
        data: {
          status: 'RUNNING',
          metadata: toPrismaJson({
            ...(typeof input.resume === 'boolean' ? { resume: input.resume } : {}),
            mode: optimizedMode,
            host: os.hostname(),
          }),
        },
      })
    );
  }

  return withDbRetry('ecu_analysis_run_create', () =>
    prisma.ecuAnalysisRun.create({
      data: {
        rootPath,
        status: 'RUNNING',
        metadata: toPrismaJson({
          mode: optimizedMode,
          host: os.hostname(),
          discoveryBatchSize: discoveryBatchSize(input),
          fingerprintBatchSize: fingerprintBatchSize(input),
          maxAnalysisBytes: maxAnalysisBytes(input),
        }),
      },
    })
  );
}

async function upsertCheckpoint(input: {
  runId: string;
  stage: EcuIngestionStage;
  rootPath: string;
  status?: string;
  lastPath?: string | null;
  discoveredFiles?: number;
  skippedFiles?: number;
  processedFiles?: number;
  failedFiles?: number;
  batchCount?: number;
  metrics?: Record<string, unknown>;
}) {
  const prisma = getPrismaClient();

  return withDbRetry('ecu_checkpoint_upsert', () =>
    prisma.ecuIngestionCheckpoint.upsert({
      where: { runId_stage: { runId: input.runId, stage: input.stage } },
      update: {
        status: input.status,
        lastPath: input.lastPath === undefined ? undefined : input.lastPath,
        discoveredFiles: input.discoveredFiles,
        skippedFiles: input.skippedFiles,
        processedFiles: input.processedFiles,
        failedFiles: input.failedFiles,
        batchCount: input.batchCount,
        metrics: input.metrics ? toPrismaJson(input.metrics) : undefined,
        pausedAt:
          input.status === 'PAUSED' ? new Date() : input.status === 'RUNNING' ? null : undefined,
      },
      create: {
        runId: input.runId,
        stage: input.stage,
        rootPath: input.rootPath,
        status: input.status ?? 'RUNNING',
        lastPath: input.lastPath,
        discoveredFiles: input.discoveredFiles ?? 0,
        skippedFiles: input.skippedFiles ?? 0,
        processedFiles: input.processedFiles ?? 0,
        failedFiles: input.failedFiles ?? 0,
        batchCount: input.batchCount ?? 0,
        metrics: input.metrics ? toPrismaJson(input.metrics) : undefined,
      },
    })
  );
}

async function shouldPause(runId: string, stage: EcuIngestionStage): Promise<boolean> {
  const prisma = getPrismaClient();
  const checkpoint = await prisma.ecuIngestionCheckpoint.findUnique({
    where: { runId_stage: { runId, stage } },
    select: { status: true },
  });

  return checkpoint?.status === 'PAUSED';
}

export async function pauseOptimizedIngestion(runId: string, stage?: EcuIngestionStage) {
  const prisma = getPrismaClient();
  await prisma.ecuIngestionCheckpoint.updateMany({
    where: { runId, ...(stage ? { stage } : {}) },
    data: { status: 'PAUSED', pausedAt: new Date() },
  });
  await prisma.ecuAnalysisRun.update({
    where: { id: runId },
    data: { status: 'PAUSED' },
  });
}

export async function resumeOptimizedIngestion(runId: string) {
  const prisma = getPrismaClient();
  await prisma.ecuIngestionCheckpoint.updateMany({
    where: { runId, status: 'PAUSED' },
    data: { status: 'RUNNING', pausedAt: null },
  });
  await prisma.ecuAnalysisRun.update({
    where: { id: runId },
    data: { status: 'RUNNING' },
  });
}

async function recordMetric(input: {
  runId: string;
  stage: EcuIngestionStage;
  metricKey: string;
  value: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrismaClient();
  await withDbRetry('ecu_metric_create', () =>
    prisma.ecuCorpusMetric.create({
      data: {
        runId: input.runId,
        stage: input.stage,
        metricKey: input.metricKey,
        value: input.value,
        unit: input.unit,
        metadata: toPrismaJson(input.metadata),
      },
    })
  );
}

async function bulkUpsertCorpusFiles(rows: ChangedDiscoveryFile[]) {
  if (rows.length === 0) {
    return;
  }

  const prisma = getPrismaClient();
  const now = new Date();
  const values = Prisma.join(
    rows.map(
      (row) =>
        Prisma.sql`(${row.id}, ${row.runId}, ${row.rootPath}, ${row.relativePath}, ${row.fullPath}, ${row.fileName}, ${row.extension}, ${row.detectedKind}, ${row.sizeBytes}, ${row.sha256}, ${row.createdAtOnDisk}, ${row.modifiedAtOnDisk}, ${now}, true, NULL, ${jsonb({ optimized: true, needsFingerprint: true, sampledHash: row.sampledHash })}, ${now}, ${now})`
    )
  );

  await withDbRetry('ecu_corpus_file_bulk_upsert_changed', () =>
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "EcuCorpusFile" (
        "id", "runId", "rootPath", "relativePath", "fullPath", "fileName", "extension",
        "detectedKind", "sizeBytes", "sha256", "createdAtOnDisk", "modifiedAtOnDisk",
        "indexedAt", "isReadable", "readError", "metadata", "createdAt", "updatedAt"
      )
      VALUES ${values}
      ON CONFLICT ("fullPath") DO UPDATE SET
        "runId" = EXCLUDED."runId",
        "rootPath" = EXCLUDED."rootPath",
        "relativePath" = EXCLUDED."relativePath",
        "fileName" = EXCLUDED."fileName",
        "extension" = EXCLUDED."extension",
        "detectedKind" = EXCLUDED."detectedKind",
        "sizeBytes" = EXCLUDED."sizeBytes",
        "sha256" = EXCLUDED."sha256",
        "createdAtOnDisk" = EXCLUDED."createdAtOnDisk",
        "modifiedAtOnDisk" = EXCLUDED."modifiedAtOnDisk",
        "indexedAt" = EXCLUDED."indexedAt",
        "isReadable" = true,
        "readError" = NULL,
        "metadata" = EXCLUDED."metadata",
        "updatedAt" = EXCLUDED."updatedAt"
    `)
  );
}

async function bulkAttachUnchangedCorpusFiles(rows: ChangedDiscoveryFile[]) {
  if (rows.length === 0) {
    return;
  }

  const prisma = getPrismaClient();
  const now = new Date();
  const values = Prisma.join(
    rows.map(
      (row) =>
        Prisma.sql`(${row.id}, ${row.runId}, ${row.rootPath}, ${row.relativePath}, ${row.fullPath}, ${row.fileName}, ${row.extension}, ${row.detectedKind}, ${row.sizeBytes}, ${row.sha256}, ${row.createdAtOnDisk}, ${row.modifiedAtOnDisk}, ${now}, true, NULL, ${jsonb({ optimized: true, reusedFingerprint: true, sampledHash: row.sampledHash })}, ${now}, ${now})`
    )
  );

  await withDbRetry('ecu_corpus_file_bulk_attach_unchanged', () =>
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "EcuCorpusFile" (
        "id", "runId", "rootPath", "relativePath", "fullPath", "fileName", "extension",
        "detectedKind", "sizeBytes", "sha256", "createdAtOnDisk", "modifiedAtOnDisk",
        "indexedAt", "isReadable", "readError", "metadata", "createdAt", "updatedAt"
      )
      VALUES ${values}
      ON CONFLICT ("fullPath") DO UPDATE SET
        "runId" = EXCLUDED."runId",
        "rootPath" = EXCLUDED."rootPath",
        "relativePath" = EXCLUDED."relativePath",
        "fileName" = EXCLUDED."fileName",
        "extension" = EXCLUDED."extension",
        "detectedKind" = EXCLUDED."detectedKind",
        "sizeBytes" = EXCLUDED."sizeBytes",
        "sha256" = EXCLUDED."sha256",
        "createdAtOnDisk" = EXCLUDED."createdAtOnDisk",
        "modifiedAtOnDisk" = EXCLUDED."modifiedAtOnDisk",
        "indexedAt" = EXCLUDED."indexedAt",
        "metadata" = COALESCE("EcuCorpusFile"."metadata", '{}'::jsonb) || EXCLUDED."metadata",
        "updatedAt" = EXCLUDED."updatedAt"
    `)
  );
}

async function bulkUpsertHashCache(rows: ChangedDiscoveryFile[]) {
  if (rows.length === 0) {
    return;
  }

  const prisma = getPrismaClient();
  const now = new Date();
  const values = Prisma.join(
    rows.map(
      (row) =>
        Prisma.sql`(${randomUUID()}, ${row.fullPath}, ${row.sizeBytes}, ${row.modifiedAtOnDisk}, ${row.sha256}, ${row.sampledHash}, ${row.runId}, ${now}, ${jsonb({ detectedKind: row.detectedKind, extension: row.extension })}, ${now}, ${now})`
    )
  );

  await withDbRetry('ecu_hash_cache_bulk_upsert', () =>
    prisma.$executeRaw(Prisma.sql`
      INSERT INTO "EcuFileHashCache" (
        "id", "fullPath", "sizeBytes", "modifiedAtOnDisk", "sha256", "sampledHash",
        "lastRunId", "lastIndexedAt", "metadata", "createdAt", "updatedAt"
      )
      VALUES ${values}
      ON CONFLICT ("fullPath") DO UPDATE SET
        "sizeBytes" = EXCLUDED."sizeBytes",
        "modifiedAtOnDisk" = EXCLUDED."modifiedAtOnDisk",
        "sha256" = EXCLUDED."sha256",
        "sampledHash" = EXCLUDED."sampledHash",
        "lastRunId" = EXCLUDED."lastRunId",
        "lastIndexedAt" = EXCLUDED."lastIndexedAt",
        "metadata" = EXCLUDED."metadata",
        "updatedAt" = EXCLUDED."updatedAt"
    `)
  );
}

async function processDiscoveryBatch(input: {
  runId: string;
  rootPath: string;
  candidates: DiscoveryCandidate[];
  analysisBytes: number;
}) {
  const prisma = getPrismaClient();
  const cachedRows = await prisma.ecuFileHashCache.findMany({
    where: { fullPath: { in: input.candidates.map((candidate) => candidate.fullPath) } },
    select: {
      fullPath: true,
      sizeBytes: true,
      modifiedAtOnDisk: true,
      sha256: true,
      sampledHash: true,
    },
  });
  const cacheByPath = new Map(cachedRows.map((row) => [row.fullPath, row]));
  const changed: ChangedDiscoveryFile[] = [];
  const unchanged: ChangedDiscoveryFile[] = [];
  let skipped = 0;
  let failed = 0;

  for (const candidate of input.candidates) {
    const cached = cacheByPath.get(candidate.fullPath);
    const isUnchanged =
      cached &&
      cached.sizeBytes === candidate.sizeBytes &&
      cached.modifiedAtOnDisk.getTime() === candidate.modifiedAtOnDisk.getTime();

    if (isUnchanged) {
      skipped += 1;
      unchanged.push({
        ...candidate,
        id: randomUUID(),
        runId: input.runId,
        rootPath: input.rootPath,
        sha256: cached.sha256,
        sampledHash: cached.sampledHash,
      });
      continue;
    }

    try {
      const sha256 = await sha256File(candidate.fullPath);
      const sample = await import('./fingerprint.js').then((module) =>
        module.readSample(candidate.fullPath, Math.min(input.analysisBytes, 64 * 1024))
      );
      changed.push({
        ...candidate,
        id: randomUUID(),
        runId: input.runId,
        rootPath: input.rootPath,
        sha256,
        sampledHash: sampledHash(sample),
      });
    } catch {
      failed += 1;
    }
  }

  await bulkUpsertCorpusFiles(changed);
  await bulkAttachUnchangedCorpusFiles(unchanged);
  await bulkUpsertHashCache([...changed, ...unchanged]);

  if (changed.length > 0) {
    const changedFiles = await prisma.ecuCorpusFile.findMany({
      where: { fullPath: { in: changed.map((row) => row.fullPath) } },
      select: { id: true },
    });
    const fileIds = changedFiles.map((file) => file.id);
    await withDbRetry('ecu_changed_file_relation_cleanup', () =>
      prisma.$transaction([
        prisma.ecuBinaryFingerprint.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuDetectedFamily.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuProjectLabel.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuMapDefinition.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuMapRegion.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuChecksumCandidate.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuDtcCandidate.deleteMany({ where: { fileId: { in: fileIds } } }),
        prisma.ecuCorpusRelationStage.deleteMany({
          where: { runId: input.runId, fileId: { in: fileIds } },
        }),
      ])
    );
  }

  return {
    changed: changed.length,
    skipped,
    failed,
  };
}

export async function discoverCorpusOptimized(
  input: OptimizedIngestionInput = {}
): Promise<OptimizedStageResult> {
  const prisma = getPrismaClient();
  const started = Date.now();
  const run = await createOrResumeRun(input);
  const rootPath = path.resolve(input.rootPath ?? run.rootPath);
  const checkpoint = await prisma.ecuIngestionCheckpoint.findUnique({
    where: { runId_stage: { runId: run.id, stage: 'discovery' } },
  });
  const resumeAfter = input.resume ? checkpoint?.lastPath : null;
  const batchSize = discoveryBatchSize(input);
  const analysisBytes = maxAnalysisBytes(input);
  const batch: DiscoveryCandidate[] = [];
  let seen = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let batchCount = checkpoint?.batchCount ?? 0;
  let lastPath: string | null = checkpoint?.lastPath ?? null;

  await upsertCheckpoint({
    runId: run.id,
    stage: 'discovery',
    rootPath,
    status: 'RUNNING',
  });

  const flush = async () => {
    if (batch.length === 0) {
      return;
    }

    const result = await processDiscoveryBatch({
      runId: run.id,
      rootPath,
      candidates: batch.splice(0, batch.length),
      analysisBytes,
    });
    processed += result.changed;
    skipped += result.skipped;
    failed += result.failed;
    batchCount += 1;
    await upsertCheckpoint({
      runId: run.id,
      stage: 'discovery',
      rootPath,
      status: 'RUNNING',
      lastPath,
      discoveredFiles: seen,
      skippedFiles: skipped,
      processedFiles: processed,
      failedFiles: failed,
      batchCount,
      metrics: {
        filesPerSecond: filesPerSecond(seen, Date.now() - started),
        memoryUsage: process.memoryUsage(),
      },
    });
  };

  for await (const fullPath of walkFiles(rootPath)) {
    if (resumeAfter && fullPath <= resumeAfter) {
      continue;
    }

    if (input.maxFiles && seen >= input.maxFiles) {
      break;
    }

    if (await shouldPause(run.id, 'discovery')) {
      await upsertCheckpoint({
        runId: run.id,
        stage: 'discovery',
        rootPath,
        status: 'PAUSED',
        lastPath,
        discoveredFiles: seen,
        skippedFiles: skipped,
        processedFiles: processed,
        failedFiles: failed,
        batchCount,
      });
      break;
    }

    seen += 1;
    lastPath = fullPath;

    try {
      const fileStat = await stat(fullPath);
      const extension = extensionOf(fullPath);
      batch.push({
        fullPath,
        relativePath: path.relative(rootPath, fullPath),
        fileName: path.basename(fullPath),
        extension,
        detectedKind: detectFileKind(extension),
        sizeBytes: BigInt(fileStat.size),
        createdAtOnDisk: fileStat.birthtime,
        modifiedAtOnDisk: fileStat.mtime,
      });
    } catch {
      failed += 1;
    }

    if (batch.length >= batchSize) {
      await flush();
    }
  }

  await flush();

  const elapsedMs = Date.now() - started;
  await recordMetric({
    runId: run.id,
    stage: 'discovery',
    metricKey: 'files_per_second',
    value: filesPerSecond(seen, elapsedMs),
    unit: 'files/sec',
    metadata: { seen, processed, skipped, failed },
  });
  await upsertCheckpoint({
    runId: run.id,
    stage: 'discovery',
    rootPath,
    status: 'COMPLETED',
    lastPath,
    discoveredFiles: seen,
    skippedFiles: skipped,
    processedFiles: processed,
    failedFiles: failed,
    batchCount,
  });
  await withDbRetry('ecu_analysis_run_update_discovery', () =>
    prisma.ecuAnalysisRun.update({
      where: { id: run.id },
      data: {
        totalFiles: seen,
        unreadableFiles: failed,
        indexedFiles: seen - failed,
        metadata: toPrismaJson({
          mode: optimizedMode,
          discovery: { seen, processed, skipped, failed, batchCount, elapsedMs },
        }),
      },
    })
  );

  return stageResult({
    runId: run.id,
    stage: 'discovery',
    processedFiles: processed,
    skippedFiles: skipped,
    failedFiles: failed,
    elapsedMs,
    filesPerSecond: filesPerSecond(seen, elapsedMs),
  });
}

function buildFingerprintFeature(input: {
  file: {
    id: string;
    fullPath: string;
    relativePath: string;
    fileName: string;
    extension: string;
    sizeBytes: bigint;
  };
  fingerprint: Awaited<ReturnType<typeof fingerprintCorpusFile>>;
}) {
  const projectLabels = extractProjectLabels({
    buffer: input.fingerprint.sampleBuffer,
    extension: input.file.extension,
    strings: input.fingerprint.strings,
    fileName: input.file.fileName,
  });
  const labelNames = [
    ...projectLabels.labels.map((label) => label.name.toUpperCase()),
    ...projectLabels.maps.map((map) => map.name.toUpperCase()),
  ].slice(0, 400);
  const stringValues = input.fingerprint.strings.map((item) => item.value).slice(0, 300);
  const detections = classifyKnownFamilies({
    fileName: input.file.fileName,
    extension: input.file.extension,
    filenameTokens: input.fingerprint.filenameTokens,
    strings: stringValues,
    labelNames,
    intelligence: input.fingerprint.intelligence,
  });
  const allValues = [
    input.file.fileName,
    input.file.relativePath,
    ...input.fingerprint.filenameTokens,
    ...stringValues,
    ...labelNames,
  ];
  const versionHints = extractVersionHints(allValues);
  const primaryDetection = detections[0];

  return {
    fileId: input.file.id,
    fullPath: input.file.fullPath,
    relativePath: input.file.relativePath,
    fileName: input.file.fileName,
    extension: input.file.extension,
    sizeBytes: input.file.sizeBytes,
    filenameTokens: input.fingerprint.filenameTokens,
    strings: stringValues,
    stringMatches: input.fingerprint.strings,
    byteSignatures: input.fingerprint.byteSignatures,
    labelNames,
    detections,
    architecture:
      primaryDetection?.architecture ??
      input.fingerprint.intelligence?.normalizedSummary.primaryArchitecture?.architecture,
    supplier:
      primaryDetection?.supplier ??
      input.fingerprint.intelligence?.normalizedSummary.probableSupplier,
    probableOem:
      primaryDetection?.oem ??
      input.fingerprint.intelligence?.normalizedSummary.probableOem ??
      inferProbableOem(allValues),
    controllerType: primaryDetection?.controllerType ?? inferControllerType(allValues),
    fuelType: primaryDetection?.fuelType ?? inferFuelType(allValues),
    softwareVersion: versionHints.softwareVersion,
    hardwareNumber: versionHints.hardwareNumber,
    entropy: input.fingerprint.entropy,
    entropyProfile: input.fingerprint.entropyProfile,
    vectorPatterns: input.fingerprint.intelligence?.vectors ?? [],
    calibrationRegions: input.fingerprint.intelligence?.calibration.probableRegions ?? [],
    mapBlockCandidates: projectLabels.maps.slice(0, 200),
    checksumCandidates: input.fingerprint.intelligence?.checksumFamilies ?? [],
    dtcCandidates: input.fingerprint.intelligence?.diagnostics.dtcTables ?? [],
    intelligenceSummary: input.fingerprint.intelligence?.normalizedSummary ?? null,
    projectMetadata: projectLabels.metadata,
  } satisfies FingerprintFeature;
}

function buildRelationStageRows(runId: string, feature: RelationStageFeature, now = new Date()) {
  const tokenRows = [...feature.filenameTokens, ...feature.labelNames.slice(0, 100)]
    .filter((token) => token.length >= 3)
    .slice(0, 80)
    .map((token) => ({
      runId,
      fileId: feature.fileId,
      fullPath: feature.fullPath,
      relationType: 'signature:token',
      relationKey: stableKey(token),
      confidence: 0.55,
      evidenceHash: createHash('sha1').update(`token:${token}`).digest('hex'),
      payload: toPrismaJson({ token }),
      createdAt: now,
      updatedAt: now,
    }));
  const byteRows = feature.byteSignatures.slice(0, 12).map((signature) => ({
    runId,
    fileId: feature.fileId,
    fullPath: feature.fullPath,
    relationType: 'signature:byte',
    relationKey: stableKey(`${signature.offset}:${signature.hex}`),
    confidence: 0.62,
    evidenceHash: createHash('sha1')
      .update(`byte:${signature.offset}:${signature.hex}`)
      .digest('hex'),
    payload: toPrismaJson(signature),
    createdAt: now,
    updatedAt: now,
  }));
  const familyRows = feature.detections.map((detection) => ({
    runId,
    fileId: feature.fileId,
    fullPath: feature.fullPath,
    relationType: 'family',
    relationKey: detection.familyKey,
    confidence: detection.confidence,
    evidenceHash: createHash('sha1').update(`family:${detection.familyKey}`).digest('hex'),
    payload: toPrismaJson(detection),
    createdAt: now,
    updatedAt: now,
  }));

  return [...tokenRows, ...byteRows, ...familyRows];
}

async function writeFingerprintBatch(runId: string, features: FingerprintFeature[]) {
  const prisma = getPrismaClient();

  if (features.length === 0) {
    return;
  }

  const now = new Date();
  await withDbRetry('ecu_fingerprint_batch_create', () =>
    prisma.ecuBinaryFingerprint.createMany({
      data: features.map((feature) => ({
        fileId: feature.fileId,
        entropy: feature.entropy,
        entropyProfile: toPrismaJson(feature.entropyProfile),
        architecture: feature.architecture,
        supplier: feature.supplier,
        probableOem: feature.probableOem,
        controllerType: feature.controllerType,
        fuelType: feature.fuelType,
        softwareVersion: feature.softwareVersion,
        hardwareNumber: feature.hardwareNumber,
        filenameTokens: toPrismaJson(feature.filenameTokens),
        stringTable: toPrismaJson(feature.stringMatches.slice(0, 300)),
        byteSignatures: toPrismaJson(feature.byteSignatures),
        vectorPatterns: toPrismaJson(feature.vectorPatterns),
        calibrationRegions: toPrismaJson(feature.calibrationRegions),
        mapBlockCandidates: toPrismaJson(feature.mapBlockCandidates),
        checksumCandidates: toPrismaJson(feature.checksumCandidates),
        dtcCandidates: toPrismaJson(feature.dtcCandidates),
        intelligenceSummary: toPrismaJson(feature.intelligenceSummary),
        metadata: toPrismaJson({
          optimized: true,
          project: feature.projectMetadata,
        }),
      })),
      skipDuplicates: true,
    })
  );

  const familyRows = features.flatMap((feature) =>
    feature.detections.map((detection) => ({
      fileId: feature.fileId,
      familyKey: detection.familyKey,
      familyLabel: detection.familyLabel,
      supplier: detection.supplier,
      oem: detection.oem,
      controllerType: detection.controllerType,
      fuelType: detection.fuelType,
      architecture: detection.architecture,
      confidence: detection.confidence,
      evidence: toPrismaJson(detection.evidence),
    }))
  );
  if (familyRows.length > 0) {
    await withDbRetry('ecu_detected_family_batch_create', () =>
      prisma.ecuDetectedFamily.createMany({ data: familyRows })
    );
  }

  const stageRows = features.flatMap((feature) => buildRelationStageRows(runId, feature, now));

  for (const rows of chunk(stageRows, 5000)) {
    await withDbRetry('ecu_relation_stage_batch_create', () =>
      prisma.ecuCorpusRelationStage.createMany({
        data: rows,
        skipDuplicates: true,
      })
    );
  }
}

export async function fingerprintCorpusOptimized(input: {
  runId: string;
  batchSize?: number;
  maxAnalysisBytes?: number;
  limit?: number;
}): Promise<OptimizedStageResult> {
  const prisma = getPrismaClient();
  const started = Date.now();
  const run = await prisma.ecuAnalysisRun.findUniqueOrThrow({ where: { id: input.runId } });
  const batchSize = input.batchSize ?? fingerprintBatchSize();
  const analysisBytes =
    input.maxAnalysisBytes ?? maxAnalysisBytes({ maxAnalysisBytes: input.maxAnalysisBytes });
  let processed = 0;
  let failed = 0;

  await upsertCheckpoint({
    runId: run.id,
    stage: 'fingerprinting',
    rootPath: run.rootPath,
    status: 'RUNNING',
  });

  while (!input.limit || processed < input.limit) {
    if (await shouldPause(run.id, 'fingerprinting')) {
      await upsertCheckpoint({
        runId: run.id,
        stage: 'fingerprinting',
        rootPath: run.rootPath,
        status: 'PAUSED',
        processedFiles: processed,
        failedFiles: failed,
      });
      break;
    }

    const take = input.limit ? Math.min(batchSize, input.limit - processed) : batchSize;
    const files = await prisma.ecuCorpusFile.findMany({
      where: {
        runId: run.id,
        isReadable: true,
        fingerprint: null,
      },
      orderBy: { indexedAt: 'asc' },
      take,
      select: {
        id: true,
        fullPath: true,
        relativePath: true,
        fileName: true,
        extension: true,
        sizeBytes: true,
      },
    });

    if (files.length === 0) {
      break;
    }

    const features: FingerprintFeature[] = [];

    for (const file of files) {
      try {
        const fingerprint = await fingerprintCorpusFile({
          filePath: file.fullPath,
          fileName: file.fileName,
          extension: file.extension,
          productContext: file.relativePath,
          maxAnalysisBytes: analysisBytes,
        });
        features.push(buildFingerprintFeature({ file, fingerprint }));
      } catch (error) {
        failed += 1;
        await prisma.ecuCorpusFile.update({
          where: { id: file.id },
          data: {
            isReadable: false,
            readError: error instanceof Error ? error.message : 'Fingerprinting failed.',
          },
        });
      }
    }

    await writeFingerprintBatch(run.id, features);
    processed += files.length;

    await upsertCheckpoint({
      runId: run.id,
      stage: 'fingerprinting',
      rootPath: run.rootPath,
      status: 'RUNNING',
      processedFiles: processed,
      failedFiles: failed,
      batchCount: Math.ceil(processed / batchSize),
      metrics: {
        filesPerSecond: filesPerSecond(processed, Date.now() - started),
        memoryUsage: process.memoryUsage(),
      },
    });
  }

  const elapsedMs = Date.now() - started;
  await recordMetric({
    runId: run.id,
    stage: 'fingerprinting',
    metricKey: 'files_per_second',
    value: filesPerSecond(processed, elapsedMs),
    unit: 'files/sec',
    metadata: { processed, failed },
  });
  await upsertCheckpoint({
    runId: run.id,
    stage: 'fingerprinting',
    rootPath: run.rootPath,
    status: 'COMPLETED',
    processedFiles: processed,
    failedFiles: failed,
  });

  return stageResult({
    runId: run.id,
    stage: 'fingerprinting',
    processedFiles: processed,
    skippedFiles: 0,
    failedFiles: failed,
    elapsedMs,
    filesPerSecond: filesPerSecond(processed, elapsedMs),
  });
}

export async function extractRelationsOptimized(input: {
  runId: string;
  batchSize?: number;
  limit?: number;
}): Promise<OptimizedStageResult> {
  const prisma = getPrismaClient();
  const started = Date.now();
  const run = await prisma.ecuAnalysisRun.findUniqueOrThrow({ where: { id: input.runId } });
  const batchSize = input.batchSize ?? envNumber('ECU_CORPUS_RELATION_BATCH_SIZE', 1000);
  let cursor: string | undefined;
  let processed = 0;

  await upsertCheckpoint({
    runId: run.id,
    stage: 'relation-extraction',
    rootPath: run.rootPath,
    status: 'RUNNING',
  });

  while (!input.limit || processed < input.limit) {
    if (await shouldPause(run.id, 'relation-extraction')) {
      await upsertCheckpoint({
        runId: run.id,
        stage: 'relation-extraction',
        rootPath: run.rootPath,
        status: 'PAUSED',
        processedFiles: processed,
      });
      break;
    }

    const take = input.limit ? Math.min(batchSize, input.limit - processed) : batchSize;
    const files = await prisma.ecuCorpusFile.findMany({
      where: {
        runId: run.id,
        isReadable: true,
        fingerprint: { isNot: null },
      },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        fullPath: true,
        fingerprint: {
          select: {
            filenameTokens: true,
            byteSignatures: true,
          },
        },
        detectedFamilies: {
          select: {
            familyKey: true,
            familyLabel: true,
            supplier: true,
            oem: true,
            controllerType: true,
            fuelType: true,
            architecture: true,
            confidence: true,
            evidence: true,
          },
        },
      },
    });

    if (files.length === 0) {
      break;
    }

    const now = new Date();
    const stageRows = files.flatMap((file) =>
      buildRelationStageRows(
        run.id,
        {
          fileId: file.id,
          fullPath: file.fullPath,
          filenameTokens: stringArray(file.fingerprint?.filenameTokens),
          labelNames: [],
          byteSignatures: byteSignatureArray(file.fingerprint?.byteSignatures),
          detections: file.detectedFamilies.map((family) => ({
            familyKey: family.familyKey,
            familyLabel: family.familyLabel,
            supplier: family.supplier ?? undefined,
            oem: family.oem ?? undefined,
            controllerType: family.controllerType as
              | CorpusFamilyDetection['controllerType']
              | undefined,
            fuelType: family.fuelType as CorpusFamilyDetection['fuelType'] | undefined,
            architecture: family.architecture ?? undefined,
            confidence: family.confidence,
            evidence: Array.isArray(family.evidence)
              ? (family.evidence as CorpusFamilyDetection['evidence'])
              : [],
          })),
        },
        now
      )
    );

    for (const rows of chunk(stageRows, 5000)) {
      await withDbRetry('ecu_relation_extract_stage_create', () =>
        prisma.ecuCorpusRelationStage.createMany({
          data: rows,
          skipDuplicates: true,
        })
      );
    }

    processed += files.length;
    cursor = files[files.length - 1]?.id;

    await upsertCheckpoint({
      runId: run.id,
      stage: 'relation-extraction',
      rootPath: run.rootPath,
      status: 'RUNNING',
      processedFiles: processed,
      batchCount: Math.ceil(processed / batchSize),
      metrics: {
        filesPerSecond: filesPerSecond(processed, Date.now() - started),
        memoryUsage: process.memoryUsage(),
      },
    });
  }

  const elapsedMs = Date.now() - started;
  await recordMetric({
    runId: run.id,
    stage: 'relation-extraction',
    metricKey: 'relations_files_per_second',
    value: filesPerSecond(processed, elapsedMs),
    unit: 'files/sec',
    metadata: { processed },
  });
  await upsertCheckpoint({
    runId: run.id,
    stage: 'relation-extraction',
    rootPath: run.rootPath,
    status: 'COMPLETED',
    processedFiles: processed,
  });

  return stageResult({
    runId: run.id,
    stage: 'relation-extraction',
    processedFiles: processed,
    skippedFiles: 0,
    failedFiles: 0,
    elapsedMs,
    filesPerSecond: filesPerSecond(processed, elapsedMs),
  });
}

export async function rebuildClustersOptimized(runId: string) {
  const prisma = getPrismaClient();
  const started = Date.now();
  const run = await prisma.ecuAnalysisRun.findUniqueOrThrow({ where: { id: runId } });
  await upsertCheckpoint({
    runId,
    stage: 'clustering',
    rootPath: run.rootPath,
    status: 'RUNNING',
  });
  const files = await prisma.ecuCorpusFile.findMany({
    where: { runId, isReadable: true },
    select: {
      id: true,
      extension: true,
      sizeBytes: true,
      fileName: true,
      fingerprint: {
        select: {
          architecture: true,
          filenameTokens: true,
        },
      },
      detectedFamilies: {
        orderBy: { confidence: 'desc' },
        take: 1,
        select: {
          familyKey: true,
          familyLabel: true,
          confidence: true,
        },
      },
    },
  });
  const groups = new Map<
    string,
    {
      label: string;
      clusterType: string;
      familyKey?: string | null;
      confidence: number;
      members: Array<{ fileId: string; score: number; tokens: string[] }>;
    }
  >();

  await withDbRetry('ecu_cluster_rebuild_cleanup', () =>
    prisma.$transaction([
      prisma.ecuUnknownFamily.deleteMany({ where: { runId } }),
      prisma.ecuFileCluster.deleteMany({ where: { runId } }),
    ])
  );

  for (const file of files) {
    const family = file.detectedFamilies[0];
    const architecture = stableKey(file.fingerprint?.architecture ?? 'unknown');
    const key = family
      ? `KNOWN:${family.familyKey}:${architecture}:${sizeBucket(file.sizeBytes)}`
      : `UNKNOWN:${file.extension || 'NOEXT'}:${architecture}:${sizeBucket(file.sizeBytes)}:${stableKey(file.fileName).slice(0, 48)}`;
    const tokens = ((file.fingerprint?.filenameTokens as string[] | null) ?? []).slice(0, 20);
    const existing = groups.get(key);

    if (existing) {
      existing.members.push({ fileId: file.id, score: family?.confidence ?? 0.45, tokens });
      existing.confidence = Math.max(existing.confidence, family?.confidence ?? 0.45);
    } else {
      groups.set(key, {
        label:
          family?.familyLabel ??
          `Unknown ECU/TCU cluster: ${tokens.slice(0, 4).join(' ') || file.extension || 'no-extension'}`,
        clusterType: family ? 'KNOWN_FAMILY' : 'UNKNOWN_FAMILY',
        familyKey: family?.familyKey,
        confidence: family?.confidence ?? 0.45,
        members: [{ fileId: file.id, score: family?.confidence ?? 0.45, tokens }],
      });
    }
  }

  for (const groupChunk of chunk(Array.from(groups.entries()), 250)) {
    const clusterRows = groupChunk.map(([clusterKey, group]) => ({
      id: randomUUID(),
      runId,
      clusterKey,
      clusterType: group.clusterType,
      label: group.label,
      familyKey: group.familyKey,
      confidence: group.confidence,
      memberCount: group.members.length,
      evidence: toPrismaJson({
        sampleTokens: group.members
          .slice(0, 10)
          .flatMap((member) => member.tokens)
          .slice(0, 30),
      }),
      metadata: toPrismaJson({ optimized: true }),
    }));

    await withDbRetry('ecu_cluster_batch_create', () =>
      prisma.ecuFileCluster.createMany({ data: clusterRows })
    );
    const clusterByKey = new Map(clusterRows.map((row) => [row.clusterKey, row]));
    const memberRows = groupChunk.flatMap(([clusterKey, group]) =>
      group.members.map((member) => ({
        clusterId: clusterByKey.get(clusterKey)?.id ?? '',
        fileId: member.fileId,
        score: member.score,
        evidence: toPrismaJson({ tokens: member.tokens }),
      }))
    );

    for (const rows of chunk(memberRows, 5000)) {
      await withDbRetry('ecu_cluster_member_batch_create', () =>
        prisma.ecuFileClusterMember.createMany({ data: rows })
      );
    }

    const unknownRows = groupChunk
      .filter(([, group]) => group.clusterType === 'UNKNOWN_FAMILY')
      .map(([clusterKey, group]) => ({
        runId,
        clusterId: clusterByKey.get(clusterKey)?.id,
        unknownKey: clusterKey,
        label: group.label,
        confidence: group.confidence,
        memberCount: group.members.length,
        evidence: toPrismaJson({
          reason: 'Optimized clustering found no high-confidence known-family classifier.',
        }),
        metadata: toPrismaJson({
          recommendedNextManualReviewStep:
            'Review representative files and promote a classifier only after shared evidence is verified.',
        }),
      }));

    if (unknownRows.length > 0) {
      await withDbRetry('ecu_unknown_family_batch_create', () =>
        prisma.ecuUnknownFamily.createMany({ data: unknownRows })
      );
    }
  }

  const elapsedMs = Date.now() - started;
  await recordMetric({
    runId,
    stage: 'clustering',
    metricKey: 'clusters_per_second',
    value: filesPerSecond(groups.size, elapsedMs),
    unit: 'clusters/sec',
    metadata: { fileCount: files.length, clusterCount: groups.size },
  });
  await upsertCheckpoint({
    runId,
    stage: 'clustering',
    rootPath: run.rootPath,
    status: 'COMPLETED',
    processedFiles: files.length,
    batchCount: groups.size,
    metrics: {
      filesPerSecond: filesPerSecond(files.length, elapsedMs),
      clusterCount: groups.size,
      memoryUsage: process.memoryUsage(),
    },
  });
  await withDbRetry('ecu_analysis_run_update_clusters', () =>
    prisma.ecuAnalysisRun.update({
      where: { id: runId },
      data: {
        clusterCount: groups.size,
        unknownFamilyCount: Array.from(groups.values()).filter(
          (group) => group.clusterType === 'UNKNOWN_FAMILY'
        ).length,
        knownFamilyCount: files.filter((file) => file.detectedFamilies.length > 0).length,
      },
    })
  );

  return stageResult({
    runId,
    stage: 'clustering',
    processedFiles: files.length,
    skippedFiles: 0,
    failedFiles: 0,
    elapsedMs,
    filesPerSecond: filesPerSecond(files.length, elapsedMs),
  });
}

export async function rebuildSignaturesOptimized(runId: string) {
  const prisma = getPrismaClient();
  const started = Date.now();
  const run = await prisma.ecuAnalysisRun.findUniqueOrThrow({ where: { id: runId } });
  await upsertCheckpoint({
    runId,
    stage: 'signature-generation',
    rootPath: run.rootPath,
    status: 'RUNNING',
  });
  await withDbRetry('ecu_signature_rebuild_cleanup', () =>
    prisma.ecuLearnedSignature.deleteMany({ where: { runId } })
  );
  const groups = await prisma.ecuCorpusRelationStage.groupBy({
    by: ['relationType', 'relationKey'],
    where: { runId, relationType: { startsWith: 'signature:' } },
    _count: { _all: true },
    _avg: { confidence: true },
    orderBy: { _count: { relationKey: 'desc' } },
    take: envNumber('ECU_CORPUS_SIGNATURE_REBUILD_LIMIT', 20000),
  });
  const countAll = (value: true | { _all?: number } | undefined): number =>
    typeof value === 'object' ? (value._all ?? 0) : 0;
  const rows = groups.flatMap((group) => {
    const occurrences = countAll(group._count);
    const avgConfidence = group._avg?.confidence ?? 0.8;

    if (occurrences < 2) {
      return [];
    }

    return [
      {
        runId,
        signatureType: group.relationType.replace('signature:', ''),
        signatureKey: group.relationKey,
        label: group.relationKey,
        confidence: Math.min(0.4 + occurrences / 100, avgConfidence, 0.95),
        evidence: toPrismaJson({
          occurrences,
          avgConfidence,
        }),
        metadata: toPrismaJson({ optimized: true }),
      },
    ];
  });

  for (const rowChunk of chunk(rows, 5000)) {
    await withDbRetry('ecu_signature_batch_create', () =>
      prisma.ecuLearnedSignature.createMany({ data: rowChunk })
    );
  }

  const elapsedMs = Date.now() - started;
  await recordMetric({
    runId,
    stage: 'signature-generation',
    metricKey: 'signatures_per_second',
    value: filesPerSecond(rows.length, elapsedMs),
    unit: 'signatures/sec',
    metadata: { stagedGroups: groups.length, signatures: rows.length },
  });
  await upsertCheckpoint({
    runId,
    stage: 'signature-generation',
    rootPath: run.rootPath,
    status: 'COMPLETED',
    processedFiles: rows.length,
    batchCount: Math.ceil(rows.length / 5000),
    metrics: {
      filesPerSecond: filesPerSecond(rows.length, elapsedMs),
      stagedGroups: groups.length,
      memoryUsage: process.memoryUsage(),
    },
  });

  return stageResult({
    runId,
    stage: 'signature-generation',
    processedFiles: rows.length,
    skippedFiles: 0,
    failedFiles: 0,
    elapsedMs,
    filesPerSecond: filesPerSecond(rows.length, elapsedMs),
  });
}

export async function runOptimizedCorpusIngestion(input: OptimizedIngestionInput = {}) {
  const discovery = await discoverCorpusOptimized(input);
  const fingerprinting = await fingerprintCorpusOptimized({
    runId: discovery.runId,
    maxAnalysisBytes: input.maxAnalysisBytes,
    batchSize: input.fingerprintBatchSize,
  });
  const relations = await extractRelationsOptimized({
    runId: discovery.runId,
    batchSize: input.batchSize,
  });
  const clustering = await rebuildClustersOptimized(discovery.runId);
  const signatures = await rebuildSignaturesOptimized(discovery.runId);
  const prisma = getPrismaClient();
  const duplicateCount = await prisma.ecuCorpusFile.groupBy({
    by: ['sha256'],
    where: { runId: discovery.runId },
    _count: { _all: true },
    having: { sha256: { _count: { gt: 1 } } },
  });
  const extensionRows = await prisma.ecuCorpusFile.groupBy({
    by: ['extension'],
    where: { runId: discovery.runId },
    _count: { _all: true },
    orderBy: { _count: { extension: 'desc' } },
  });
  const summary = {
    runId: discovery.runId,
    stages: { discovery, fingerprinting, relations, clustering, signatures },
    extensionBreakdown: Object.fromEntries(
      extensionRows.map((row) => [row.extension || '[none]', row._count._all])
    ),
    duplicateCount: duplicateCount.reduce((total, row) => total + row._count._all - 1, 0),
  };

  await prisma.ecuAnalysisRun.update({
    where: { id: discovery.runId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      duplicateFiles: summary.duplicateCount,
      extensionBreakdown: toPrismaJson(summary.extensionBreakdown),
      summary: toPrismaJson(summary),
    },
  });

  return toJsonSafe(summary);
}

export async function resetFailedOptimizedJobs(runId: string) {
  const prisma = getPrismaClient();
  await prisma.ecuCorpusFile.updateMany({
    where: { runId, isReadable: false },
    data: {
      isReadable: true,
      readError: null,
    },
  });
  await prisma.ecuIngestionCheckpoint.updateMany({
    where: { runId, status: 'FAILED' },
    data: { status: 'RUNNING' },
  });
}

export async function verifyCorpusIntegrity(runId?: string) {
  const prisma = getPrismaClient();
  const run =
    runId ??
    (
      await prisma.ecuAnalysisRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      })
    )?.id;

  if (!run) {
    throw new Error('No ECU corpus run found.');
  }

  const [files, fingerprints, missingFingerprints, duplicateGroups, unreadable] = await Promise.all(
    [
      prisma.ecuCorpusFile.count({ where: { runId: run } }),
      prisma.ecuBinaryFingerprint.count({ where: { file: { runId: run } } }),
      prisma.ecuCorpusFile.count({ where: { runId: run, isReadable: true, fingerprint: null } }),
      prisma.ecuCorpusFile.groupBy({
        by: ['sha256'],
        where: { runId: run },
        _count: { _all: true },
        having: { sha256: { _count: { gt: 1 } } },
        orderBy: { _count: { sha256: 'desc' } },
        take: 100,
      }),
      prisma.ecuCorpusFile.count({ where: { runId: run, isReadable: false } }),
    ]
  );

  return toJsonSafe({
    runId: run,
    files,
    fingerprints,
    missingFingerprints,
    duplicateGroupSample: duplicateGroups.length,
    unreadable,
    healthy: missingFingerprints === 0,
  });
}

export async function getOptimizedCorpusMetrics(runId?: string) {
  const prisma = getPrismaClient();
  const run =
    runId ??
    (
      await prisma.ecuAnalysisRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      })
    )?.id;

  if (!run) {
    throw new Error('No ECU corpus run found.');
  }

  const [
    analysisRun,
    checkpoints,
    metrics,
    fileCount,
    clusterCount,
    signatureCount,
    failedFiles,
    activeWorkers,
  ] = await Promise.all([
    prisma.ecuAnalysisRun.findUnique({ where: { id: run } }),
    prisma.ecuIngestionCheckpoint.findMany({ where: { runId: run }, orderBy: { stage: 'asc' } }),
    prisma.ecuCorpusMetric.findMany({
      where: { runId: run },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.ecuCorpusFile.count({ where: { runId: run } }),
    prisma.ecuFileCluster.count({ where: { runId: run } }),
    prisma.ecuLearnedSignature.count({ where: { runId: run } }),
    prisma.ecuCorpusFile.count({ where: { runId: run, isReadable: false } }),
    prisma.workerHeartbeat.count({
      where: {
        queueName: process.env.ECU_CORPUS_QUEUE_PREFIX ?? 'ecu-corpus',
        status: 'ONLINE',
        lastSeenAt: {
          gte: new Date(
            Date.now() - Number.parseInt(process.env.WORKER_HEARTBEAT_STALE_AFTER_MS ?? '60000', 10)
          ),
        },
      },
    }),
  ]);
  const latestMetricRate = metrics.find((metric) => metric.metricKey === 'files_per_second')?.value;
  const latestCheckpointMetrics = checkpoints.find((checkpoint) => checkpoint.metrics)?.metrics as
    | { filesPerSecond?: number }
    | null
    | undefined;
  const latestRate = latestMetricRate ?? latestCheckpointMetrics?.filesPerSecond;
  const filesPerSec = typeof latestRate === 'number' ? latestRate : null;
  const etaSeconds =
    filesPerSec && analysisRun?.totalFiles
      ? Math.max((analysisRun.totalFiles - fileCount) / filesPerSec, 0)
      : null;

  return toJsonSafe({
    run: analysisRun,
    checkpoints,
    metrics,
    runtime: {
      memoryUsage: process.memoryUsage(),
      activeWorkers,
      cpuCount: os.cpus().length,
    },
    growth: {
      files: fileCount,
      clusters: clusterCount,
      signatures: signatureCount,
      failedFiles,
    },
    throughput: {
      filesPerSec,
      etaSeconds,
    },
  });
}

export async function getIngestionBottleneckReport(runId?: string) {
  const prisma = getPrismaClient();
  const run =
    runId ??
    (
      await prisma.ecuAnalysisRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      })
    )?.id;

  if (!run) {
    throw new Error('No ECU corpus run found.');
  }

  const [analysisRun, checkpoints, metrics] = await withDbRetry('ecu_bottleneck_report_read', () =>
    Promise.all([
      prisma.ecuAnalysisRun.findUnique({ where: { id: run } }),
      prisma.ecuIngestionCheckpoint.findMany({
        where: { runId: run },
        orderBy: { stage: 'asc' },
      }),
      prisma.ecuCorpusMetric.findMany({
        where: { runId: run },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ])
  );

  const stageSummaries = checkpoints.map((checkpoint) => {
    const checkpointMetrics = checkpoint.metrics as {
      filesPerSecond?: number;
      memoryUsage?: { rss?: number; heapUsed?: number };
    } | null;
    const stageMetrics = metrics.filter((metric) => metric.stage === checkpoint.stage);
    const latestThroughput =
      stageMetrics.find((metric) => metric.metricKey.includes('files_per_second'))?.value ??
      checkpointMetrics?.filesPerSecond ??
      null;

    return {
      stage: checkpoint.stage,
      status: checkpoint.status,
      processedFiles: checkpoint.processedFiles,
      skippedFiles: checkpoint.skippedFiles,
      failedFiles: checkpoint.failedFiles,
      batchCount: checkpoint.batchCount,
      filesPerSecond: latestThroughput,
      rssBytes: checkpointMetrics?.memoryUsage?.rss ?? null,
      updatedAt: checkpoint.updatedAt,
    };
  });
  const slowestStages = [...stageSummaries]
    .filter((stage) => typeof stage.filesPerSecond === 'number' && stage.processedFiles > 0)
    .sort((left, right) => (left.filesPerSecond ?? Infinity) - (right.filesPerSecond ?? Infinity))
    .slice(0, 3);
  const memoryHotspots = [...stageSummaries]
    .filter((stage) => typeof stage.rssBytes === 'number')
    .sort((left, right) => (right.rssBytes ?? 0) - (left.rssBytes ?? 0))
    .slice(0, 3);

  return toJsonSafe({
    run: analysisRun,
    stageSummaries,
    bottlenecks: {
      slowestStages,
      memoryHotspots,
      failedStages: stageSummaries.filter(
        (stage) => stage.failedFiles > 0 || stage.status === 'FAILED'
      ),
    },
    recommendations: [
      slowestStages[0]?.stage === 'fingerprinting'
        ? 'Fingerprinting is the current throughput bottleneck; tune ECU_CORPUS_FINGERPRINT_BATCH_SIZE and worker concurrency before changing analysis logic.'
        : null,
      memoryHotspots[0]?.rssBytes &&
      memoryHotspots[0].rssBytes >
        Number.parseInt(
          process.env.ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES ?? String(1536 * 1024 * 1024),
          10
        )
        ? 'RSS exceeded configured memory limit; reduce batch size or worker concurrency.'
        : null,
    ].filter(Boolean),
  });
}
