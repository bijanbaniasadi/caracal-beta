import { getPrismaClient } from '@caracal/db';
import { Prisma } from '@prisma/client';
import { Router, type Router as ExpressRouter } from 'express';

import { sendSuccess } from '../lib/api-response.js';
import { asyncHandler } from '../lib/async-handler.js';
import { writeAuditLog } from '../lib/audit.js';
import { compareCorpusFiles } from '../lib/ecu-corpus/indexer.js';
import {
  getIngestionBottleneckReport,
  getOptimizedCorpusMetrics,
  pauseOptimizedIngestion,
  rebuildClustersOptimized,
  rebuildSignaturesOptimized,
  resetFailedOptimizedJobs,
  resumeOptimizedIngestion,
  runOptimizedCorpusIngestion,
  verifyCorpusIntegrity,
  type EcuIngestionStage,
} from '../lib/ecu-corpus/optimized-ingestion.js';
import {
  enqueueEcuCorpusPipeline,
  getEcuCorpusQueueStats,
  pauseEcuCorpusQueues,
  resetFailedEcuCorpusQueueJobs,
  resumeEcuCorpusQueues,
} from '../lib/ecu-corpus/queues.js';
import { toJsonSafe } from '../lib/ecu-corpus/serialization.js';
import { badRequest, notFound } from '../lib/errors.js';
import { validateBody } from '../middleware/validate.js';
import {
  ecuCorpusCompareSchema,
  ecuCorpusListQuerySchema,
  ecuCorpusMatchUploadSchema,
  ecuCorpusOptimizedScanSchema,
  ecuCorpusRunControlSchema,
  type EcuCorpusCompareInput,
  type EcuCorpusListQuery,
  type EcuCorpusMatchUploadInput,
  type EcuCorpusOptimizedScanInput,
  type EcuCorpusRunControlInput,
} from '../schemas/ecu-corpus.js';

export const ecuCorpusRouter: ExpressRouter = Router();

function parseListQuery(query: unknown): EcuCorpusListQuery {
  return ecuCorpusListQuerySchema.parse(query);
}

function paginationMeta<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const pageItems = hasMore ? items.slice(0, limit) : items;

  return {
    pageItems,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id : null,
    },
  };
}

async function latestRunId(): Promise<string | null> {
  const prisma = getPrismaClient();
  const latest = await prisma.ecuAnalysisRun.findFirst({
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });

  return latest?.id ?? null;
}

function fileWhere(query: EcuCorpusListQuery): Prisma.EcuCorpusFileWhereInput {
  const and: Prisma.EcuCorpusFileWhereInput[] = [];

  if (query.q) {
    and.push({
      OR: [
        { fileName: { contains: query.q, mode: 'insensitive' } },
        { relativePath: { contains: query.q, mode: 'insensitive' } },
        { fullPath: { contains: query.q, mode: 'insensitive' } },
        { sha256: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }

  if (query.extension) {
    and.push({
      extension: query.extension.startsWith('.') ? query.extension : `.${query.extension}`,
    });
  }

  if (query.family) {
    and.push({
      detectedFamilies: {
        some: {
          OR: [
            { familyKey: { contains: query.family, mode: 'insensitive' } },
            { familyLabel: { contains: query.family, mode: 'insensitive' } },
          ],
        },
      },
    });
  }

  if (query.oem) {
    and.push({
      OR: [
        { fingerprint: { probableOem: { contains: query.oem, mode: 'insensitive' } } },
        { detectedFamilies: { some: { oem: { contains: query.oem, mode: 'insensitive' } } } },
      ],
    });
  }

  if (query.token) {
    and.push({
      OR: [
        { fileName: { contains: query.token, mode: 'insensitive' } },
        { projectLabels: { some: { name: { contains: query.token, mode: 'insensitive' } } } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

ecuCorpusRouter.post(
  '/scan',
  validateBody(ecuCorpusOptimizedScanSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusOptimizedScanInput;
    const summary = (await runOptimizedCorpusIngestion(input)) as {
      runId: string;
      duplicateCount: number;
      stages: {
        discovery: { processedFiles: number; skippedFiles: number; failedFiles: number };
        clustering: { processedFiles: number };
        signatures: { processedFiles: number };
      };
    };

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.scan_completed',
      entityType: 'EcuAnalysisRun',
      entityId: summary.runId,
      metadata: {
        rootPath: input.rootPath,
        changedFiles: summary.stages.discovery.processedFiles,
        skippedFiles: summary.stages.discovery.skippedFiles,
        failedFiles: summary.stages.discovery.failedFiles,
        clusteredFiles: summary.stages.clustering.processedFiles,
        signatureCount: summary.stages.signatures.processedFiles,
        duplicateCount: summary.duplicateCount,
      },
    });

    sendSuccess(res, summary, 201);
  })
);

ecuCorpusRouter.post(
  '/scan/enqueue',
  validateBody(ecuCorpusOptimizedScanSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusOptimizedScanInput;
    const job = await enqueueEcuCorpusPipeline(input);

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.scan_queued',
      entityType: 'Queue',
      entityId: job.queueName,
      metadata: {
        jobId: job.id,
        rootPath: input.rootPath,
        maxFiles: input.maxFiles,
      },
    });

    sendSuccess(
      res,
      {
        queued: true,
        jobId: job.id,
        queueName: job.queueName,
      },
      202
    );
  })
);

ecuCorpusRouter.post(
  '/pause',
  validateBody(ecuCorpusRunControlSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusRunControlInput;
    await pauseOptimizedIngestion(input.runId, input.stage as EcuIngestionStage | undefined);
    await pauseEcuCorpusQueues();

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.scan_paused',
      entityType: 'EcuAnalysisRun',
      entityId: input.runId,
      metadata: { stage: input.stage },
    });

    sendSuccess(res, { paused: true, runId: input.runId, stage: input.stage ?? null });
  })
);

ecuCorpusRouter.post(
  '/resume',
  validateBody(ecuCorpusRunControlSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusRunControlInput;
    await resumeOptimizedIngestion(input.runId);
    await resumeEcuCorpusQueues();

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.scan_resumed',
      entityType: 'EcuAnalysisRun',
      entityId: input.runId,
      metadata: { stage: input.stage },
    });

    sendSuccess(res, { resumed: true, runId: input.runId });
  })
);

ecuCorpusRouter.post(
  '/reset-failed',
  validateBody(ecuCorpusRunControlSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusRunControlInput;
    await resetFailedOptimizedJobs(input.runId);
    const queues = await resetFailedEcuCorpusQueueJobs();

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.failed_jobs_reset',
      entityType: 'EcuAnalysisRun',
      entityId: input.runId,
      metadata: { queues },
    });

    sendSuccess(res, { resetFailed: true, runId: input.runId, queues });
  })
);

ecuCorpusRouter.post(
  '/rebuild-clusters',
  validateBody(ecuCorpusRunControlSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusRunControlInput;
    const result = await rebuildClustersOptimized(input.runId);

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.clusters_rebuilt',
      entityType: 'EcuAnalysisRun',
      entityId: input.runId,
    });

    sendSuccess(res, result);
  })
);

ecuCorpusRouter.post(
  '/rebuild-signatures',
  validateBody(ecuCorpusRunControlSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusRunControlInput;
    const result = await rebuildSignaturesOptimized(input.runId);

    await writeAuditLog(req, {
      action: 'admin.ecu_corpus.signatures_rebuilt',
      entityType: 'EcuAnalysisRun',
      entityId: input.runId,
    });

    sendSuccess(res, result);
  })
);

ecuCorpusRouter.get(
  '/runtime/metrics',
  asyncHandler(async (req, res) => {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined;
    sendSuccess(res, await getOptimizedCorpusMetrics(runId));
  })
);

ecuCorpusRouter.get(
  '/runtime/bottlenecks',
  asyncHandler(async (req, res) => {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined;
    sendSuccess(res, await getIngestionBottleneckReport(runId));
  })
);

ecuCorpusRouter.get(
  '/runtime/dashboard',
  asyncHandler(async (req, res) => {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined;
    const [metrics, bottlenecks, queues] = await Promise.all([
      getOptimizedCorpusMetrics(runId),
      getIngestionBottleneckReport(runId),
      getEcuCorpusQueueStats(),
    ]);

    sendSuccess(res, {
      generatedAt: new Date().toISOString(),
      metrics,
      bottlenecks,
      queues,
    });
  })
);

ecuCorpusRouter.get(
  '/runtime/verify',
  asyncHandler(async (req, res) => {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined;
    sendSuccess(res, await verifyCorpusIntegrity(runId));
  })
);

ecuCorpusRouter.get(
  '/queues',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getEcuCorpusQueueStats());
  })
);

ecuCorpusRouter.get(
  '/runs/latest',
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    const run = await prisma.ecuAnalysisRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    if (!run) {
      throw notFound('No ECU corpus analysis runs found.');
    }

    sendSuccess(res, toJsonSafe(run));
  })
);

ecuCorpusRouter.get(
  '/files',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const prisma = getPrismaClient();
    const rows = await prisma.ecuCorpusFile.findMany({
      where: fileWhere(query),
      include: {
        fingerprint: {
          select: {
            architecture: true,
            supplier: true,
            probableOem: true,
            controllerType: true,
            fuelType: true,
            softwareVersion: true,
            hardwareNumber: true,
          },
        },
        detectedFamilies: {
          orderBy: { confidence: 'desc' },
          take: 3,
        },
        _count: {
          select: {
            projectLabels: true,
            mapDefinitions: true,
            clusterMemberships: true,
          },
        },
      },
      orderBy: [{ indexedAt: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, toJsonSafe(pageItems), 200, { pagination });
  })
);

ecuCorpusRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const prisma = getPrismaClient();
    const files = await prisma.ecuCorpusFile.findMany({
      where: fileWhere(query),
      include: {
        detectedFamilies: { orderBy: { confidence: 'desc' }, take: 2 },
        fingerprint: true,
      },
      orderBy: [{ indexedAt: 'desc' }],
      take: query.limit,
    });
    const clusters = await prisma.ecuFileCluster.findMany({
      where: query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' } },
              { familyKey: { contains: query.q, mode: 'insensitive' } },
              { clusterKey: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ confidence: 'desc' }],
      take: Math.min(query.limit, 50),
    });

    sendSuccess(res, toJsonSafe({ files, clusters }));
  })
);

ecuCorpusRouter.get(
  '/clusters',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const prisma = getPrismaClient();
    const runId = await latestRunId();
    const rows = await prisma.ecuFileCluster.findMany({
      where: {
        ...(runId ? { runId } : {}),
        ...(query.q
          ? {
              OR: [
                { label: { contains: query.q, mode: 'insensitive' } },
                { clusterKey: { contains: query.q, mode: 'insensitive' } },
                { familyKey: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        unknown: true,
        signatures: {
          orderBy: { confidence: 'desc' },
          take: 8,
        },
      },
      orderBy: [{ memberCount: 'desc' }, { confidence: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, toJsonSafe(pageItems), 200, { pagination });
  })
);

ecuCorpusRouter.get(
  '/clusters/unknown',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const prisma = getPrismaClient();
    const runId = await latestRunId();
    const rows = await prisma.ecuUnknownFamily.findMany({
      where: {
        ...(runId ? { runId } : {}),
        ...(query.q
          ? {
              OR: [
                { label: { contains: query.q, mode: 'insensitive' } },
                { unknownKey: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        cluster: {
          include: {
            signatures: {
              orderBy: { confidence: 'desc' },
              take: 8,
            },
          },
        },
      },
      orderBy: [{ memberCount: 'desc' }, { confidence: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, toJsonSafe(pageItems), 200, { pagination });
  })
);

ecuCorpusRouter.post(
  '/compare',
  validateBody(ecuCorpusCompareSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusCompareInput;
    const comparison = await compareCorpusFiles(input.leftFileId, input.rightFileId);

    sendSuccess(res, comparison);
  })
);

ecuCorpusRouter.get(
  '/ori-mod-pairs',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const prisma = getPrismaClient();
    const runId = await latestRunId();
    const rows = await prisma.ecuOriModPair.findMany({
      where: runId ? { runId } : undefined,
      include: {
        originalFile: {
          select: { id: true, relativePath: true, fileName: true, sha256: true, sizeBytes: true },
        },
        modifiedFile: {
          select: { id: true, relativePath: true, fileName: true, sha256: true, sizeBytes: true },
        },
      },
      orderBy: [{ confidence: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, toJsonSafe(pageItems), 200, { pagination });
  })
);

ecuCorpusRouter.post(
  '/ori-mod-pairs/detect',
  asyncHandler(async (_req, res) => {
    const prisma = getPrismaClient();
    const runId = await latestRunId();

    if (!runId) {
      throw badRequest('Run a corpus scan before detecting ORI/MOD pairs.');
    }

    const count = await prisma.ecuOriModPair.count({ where: { runId } });
    const pairs = await prisma.ecuOriModPair.findMany({
      where: { runId },
      orderBy: { confidence: 'desc' },
      take: 50,
      include: {
        originalFile: { select: { id: true, relativePath: true, fileName: true } },
        modifiedFile: { select: { id: true, relativePath: true, fileName: true } },
      },
    });

    sendSuccess(res, toJsonSafe({ runId, count, pairs }));
  })
);

ecuCorpusRouter.get(
  '/signatures',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const prisma = getPrismaClient();
    const runId = await latestRunId();
    const rows = await prisma.ecuLearnedSignature.findMany({
      where: {
        ...(runId ? { runId } : {}),
        ...(query.q
          ? {
              OR: [
                { label: { contains: query.q, mode: 'insensitive' } },
                { signatureKey: { contains: query.q, mode: 'insensitive' } },
                { signatureType: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        cluster: {
          select: { id: true, label: true, clusterType: true, familyKey: true, memberCount: true },
        },
      },
      orderBy: [{ confidence: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const { pageItems, pagination } = paginationMeta(rows, query.limit);

    sendSuccess(res, toJsonSafe(pageItems), 200, { pagination });
  })
);

ecuCorpusRouter.post(
  '/match-uploaded-bin',
  validateBody(ecuCorpusMatchUploadSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as EcuCorpusMatchUploadInput;
    const prisma = getPrismaClient();
    const upload = await prisma.binUpload.findUnique({
      where: { id: input.uploadId },
      include: {
        analysisResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!upload) {
      throw notFound('BIN upload not found.', { uploadId: input.uploadId });
    }

    const exactMatches = await prisma.ecuCorpusFile.findMany({
      where: { sha256: upload.sha256 },
      include: {
        detectedFamilies: { orderBy: { confidence: 'desc' }, take: 3 },
        clusterMemberships: {
          include: { cluster: true },
          take: 5,
        },
      },
      take: input.limit,
    });
    const sameSizeMatches = await prisma.ecuCorpusFile.findMany({
      where: {
        sizeBytes: BigInt(upload.byteSize),
        sha256: { not: upload.sha256 },
      },
      include: {
        detectedFamilies: { orderBy: { confidence: 'desc' }, take: 2 },
      },
      take: input.limit,
      orderBy: { indexedAt: 'desc' },
    });

    sendSuccess(
      res,
      toJsonSafe({
        upload: {
          id: upload.id,
          originalFileName: upload.originalFileName,
          byteSize: upload.byteSize,
          sha256: upload.sha256,
        },
        exactMatches,
        sameSizeMatches,
        possibleMatchingLabels: exactMatches.flatMap((match) =>
          match.clusterMemberships.map((membership) => membership.cluster.label)
        ),
        recommendedNextManualReviewStep:
          exactMatches.length > 0
            ? 'Review exact corpus matches and same-cluster project labels before opening the uploaded BIN.'
            : 'Review same-size candidates and run compare on the closest corpus files; no patching is performed.',
      })
    );
  })
);

ecuCorpusRouter.get(
  '/files/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const prisma = getPrismaClient();

    const file = await prisma.ecuCorpusFile.findUnique({
      where: { id },
      include: {
        fingerprint: true,
        detectedFamilies: { orderBy: { confidence: 'desc' } },
        projectLabels: { orderBy: { confidence: 'desc' }, take: 100 },
        mapDefinitions: {
          orderBy: [{ address: 'asc' }],
          take: 200,
          include: {
            regions: { orderBy: [{ offset: 'asc' }] },
          },
        },
        checksumCandidates: { orderBy: { confidence: 'desc' } },
        dtcCandidates: { orderBy: { confidence: 'desc' } },
        clusterMemberships: {
          include: {
            cluster: {
              select: {
                id: true,
                label: true,
                clusterKey: true,
                familyKey: true,
                clusterType: true,
                confidence: true,
              },
            },
          },
          orderBy: { score: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            projectLabels: true,
            mapDefinitions: true,
            clusterMemberships: true,
          },
        },
      },
    });

    if (!file) {
      throw notFound('ECU corpus file not found.', { id });
    }

    sendSuccess(res, toJsonSafe(file));
  })
);

ecuCorpusRouter.get(
  '/ori-mod-pairs/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const prisma = getPrismaClient();

    const pair = await prisma.ecuOriModPair.findUnique({
      where: { id },
      include: {
        originalFile: {
          select: {
            id: true,
            fileName: true,
            relativePath: true,
            sha256: true,
            sizeBytes: true,
            detectedKind: true,
          },
        },
        modifiedFile: {
          select: {
            id: true,
            fileName: true,
            relativePath: true,
            sha256: true,
            sizeBytes: true,
            detectedKind: true,
          },
        },
        modificationSignatures: { orderBy: { confidence: 'desc' } },
      },
    });

    if (!pair) {
      throw notFound('ORI/MOD pair not found.', { id });
    }

    sendSuccess(res, toJsonSafe(pair));
  })
);

ecuCorpusRouter.get(
  '/label-candidates',
  asyncHandler(async (req, res) => {
    const query = parseListQuery(req.query);
    const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : undefined;

    if (!fileId) {
      throw badRequest('fileId is required.');
    }

    const prisma = getPrismaClient();
    const memberships = await prisma.ecuFileClusterMember.findMany({
      where: { fileId },
      select: { clusterId: true },
    });
    const clusterIds = memberships.map((membership) => membership.clusterId);
    const candidates = await prisma.ecuCorpusFile.findMany({
      where: {
        clusterMemberships: { some: { clusterId: { in: clusterIds } } },
        detectedKind: { in: ['project-label', 'text'] },
      },
      include: {
        projectLabels: { take: 20, orderBy: { confidence: 'desc' } },
        mapDefinitions: { take: 20 },
      },
      take: query.limit,
    });

    sendSuccess(
      res,
      toJsonSafe({
        fileId,
        candidates,
        recommendedNextManualReviewStep:
          'Open the highest-confidence project label candidates and verify addresses/axes manually before using labels.',
      })
    );
  })
);
