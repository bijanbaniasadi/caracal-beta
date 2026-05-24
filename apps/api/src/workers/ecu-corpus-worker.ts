import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';
import { Worker } from 'bullmq';
import os from 'node:os';

import {
  createWorkerId,
  markWorkerHeartbeat,
  startWorkerHeartbeat,
} from '../lib/bin-analysis/heartbeat.js';
import { getRedisConnectionOptions } from '../lib/bin-analysis/queue.js';
import {
  discoverCorpusOptimized,
  extractRelationsOptimized,
  fingerprintCorpusOptimized,
  rebuildClustersOptimized,
  rebuildSignaturesOptimized,
} from '../lib/ecu-corpus/optimized-ingestion.js';
import {
  closeEcuCorpusQueues,
  ecuCorpusQueuePrefix,
  ecuCorpusStages,
  ecuCorpusQueueName,
  enqueueEcuCorpusStage,
  startEcuCorpusQueueMaintenanceCron,
  type EcuCorpusStageJobData,
} from '../lib/ecu-corpus/queues.js';
import { logger } from '../lib/logger.js';

const cpuCount = Math.max(1, Math.floor(os.cpus().length / 2));
const configuredConcurrency = Number.parseInt(
  process.env.ECU_CORPUS_WORKER_CONCURRENCY ?? String(cpuCount),
  10
);
const workerId =
  process.env.ECU_CORPUS_WORKER_ID ?? createWorkerId('ecu-corpus-worker', ecuCorpusQueuePrefix);
const heartbeatConfig = {
  workerId,
  workerType: 'ecu-corpus-worker',
  queueName: ecuCorpusQueuePrefix,
  concurrency: configuredConcurrency,
  metadata: {
    runtime: 'node',
    pid: process.pid,
    stages: ecuCorpusStages,
  },
};
const stopHeartbeat = startWorkerHeartbeat(heartbeatConfig);
const stopMaintenance = startEcuCorpusQueueMaintenanceCron();
const workers: Worker<EcuCorpusStageJobData>[] = [];
let shuttingDown = false;

function memoryLimitBytes(): number {
  return Number.parseInt(
    process.env.ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES ?? String(1536 * 1024 * 1024),
    10
  );
}

function assertMemoryHeadroom() {
  const usage = process.memoryUsage();

  if (usage.rss > memoryLimitBytes()) {
    throw new Error(`ECU corpus worker memory limit exceeded: rss=${usage.rss}`);
  }
}

for (const stage of ecuCorpusStages) {
  const worker = new Worker<EcuCorpusStageJobData>(
    ecuCorpusQueueName(stage),
    async (job) => {
      assertMemoryHeadroom();
      const data = job.data;

      logger.info(
        { stage, jobId: job.id, runId: data.runId, workerId },
        'ECU corpus stage started'
      );

      if (stage === 'discovery') {
        const result = await discoverCorpusOptimized(data.input ?? {});
        await enqueueEcuCorpusStage('fingerprinting', {
          stage: 'fingerprinting',
          runId: result.runId,
          input: data.input,
        });
        return result;
      }

      if (!data.runId) {
        throw new Error(`${stage} requires runId`);
      }

      if (stage === 'fingerprinting') {
        const result = await fingerprintCorpusOptimized({
          runId: data.runId,
          batchSize: data.input?.fingerprintBatchSize,
          maxAnalysisBytes: data.input?.maxAnalysisBytes,
        });
        await enqueueEcuCorpusStage('relation-extraction', {
          stage: 'relation-extraction',
          runId: data.runId,
          input: data.input,
        });
        return result;
      }

      if (stage === 'relation-extraction') {
        const result = await extractRelationsOptimized({
          runId: data.runId,
          batchSize: data.input?.batchSize,
        });
        await enqueueEcuCorpusStage('clustering', {
          stage: 'clustering',
          runId: data.runId,
          input: data.input,
        });
        return result;
      }

      if (stage === 'clustering') {
        const result = await rebuildClustersOptimized(data.runId);
        await enqueueEcuCorpusStage('signature-generation', {
          stage: 'signature-generation',
          runId: data.runId,
          input: data.input,
        });
        return result;
      }

      if (stage === 'signature-generation') {
        return rebuildSignaturesOptimized(data.runId);
      }

      throw new Error(`Unsupported ECU corpus stage: ${stage}`);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: configuredConcurrency,
      lockDuration: Number.parseInt(process.env.ECU_CORPUS_QUEUE_LOCK_DURATION_MS ?? '300000', 10),
      stalledInterval: Number.parseInt(
        process.env.ECU_CORPUS_QUEUE_STALLED_INTERVAL_MS ?? '60000',
        10
      ),
      maxStalledCount: Number.parseInt(process.env.ECU_CORPUS_QUEUE_MAX_STALLED_COUNT ?? '2', 10),
    }
  );

  worker.on('completed', (job) => {
    logger.info({ stage, jobId: job.id, workerId }, 'ECU corpus stage completed');
  });
  worker.on('failed', (job, error) => {
    logger.error({ err: error, stage, jobId: job?.id, workerId }, 'ECU corpus stage failed');
  });
  worker.on('error', (error) => {
    logger.error({ err: error, stage, workerId }, 'ECU corpus worker error');
    void markWorkerHeartbeat(heartbeatConfig, 'ERROR', { error: error.message, stage });
  });
  workers.push(worker);
}

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal, workerId }, 'shutting down ECU corpus workers');
  stopMaintenance();
  await markWorkerHeartbeat(heartbeatConfig, 'STOPPING', { signal });
  await Promise.allSettled([
    ...workers.map((worker) => worker.close()),
    closeEcuCorpusQueues(),
    stopHeartbeat(),
  ]);
  await disconnectPrismaClient();
  process.exit(0);
}

process.on('SIGINT', (signal) => void shutdown(signal));
process.on('SIGTERM', (signal) => void shutdown(signal));
