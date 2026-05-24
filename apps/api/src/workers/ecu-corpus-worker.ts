import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';
import { Worker } from 'bullmq';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

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
  ecuCorpusQueueName,
  ecuCorpusQueuePrefix,
  ecuCorpusStages,
  enqueueEcuCorpusStage,
  startEcuCorpusQueueMaintenanceCron,
  type EcuCorpusStageJobData,
} from '../lib/ecu-corpus/queues.js';
import { logger } from '../lib/logger.js';
import { startMemoryMonitor } from '../lib/observability/memory-monitor.js';
import {
  ecuCorpusQueueLatency,
  ecuCorpusRedisErrors,
  ecuCorpusShutdownDuration,
  ecuCorpusStalledJobs,
  ecuCorpusWorkerJobs,
  recordStageMetrics,
  setWorkerMemory,
} from '../lib/observability/metrics.js';
import { installRuntimeProcessGuards } from '../lib/observability/runtime-events.js';

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
const workers: Worker<EcuCorpusStageJobData>[] = [];
let shuttingDown = false;

function memoryLimitBytes(): number {
  return Number.parseInt(
    process.env.ECU_CORPUS_WORKER_MEMORY_LIMIT_BYTES ?? String(1536 * 1024 * 1024),
    10
  );
}

const stopHeartbeat = startWorkerHeartbeat(heartbeatConfig);
const stopMaintenance = startEcuCorpusQueueMaintenanceCron();
const memoryMonitor = startMemoryMonitor({
  workerId,
  warningRssBytes: memoryLimitBytes(),
});

function assertMemoryHeadroom() {
  const usage = process.memoryUsage();
  setWorkerMemory(workerId, usage);

  if (usage.rss > memoryLimitBytes()) {
    throw new Error(`ECU corpus worker memory limit exceeded: rss=${usage.rss}`);
  }
}

installRuntimeProcessGuards({
  service: 'ecu-corpus-worker',
  workerId,
  onFatal: async (error) => {
    await markWorkerHeartbeat(heartbeatConfig, 'ERROR', {
      error: error.message,
      memory: memoryMonitor.read(),
    });
  },
});

for (const stage of ecuCorpusStages) {
  const worker = new Worker<EcuCorpusStageJobData>(
    ecuCorpusQueueName(stage),
    async (job) => {
      assertMemoryHeadroom();
      const data = job.data;
      const queueLatencyMs = Math.max(Date.now() - job.timestamp, 0);
      ecuCorpusQueueLatency.observe({ stage }, queueLatencyMs / 1000);

      logger.info(
        {
          event: 'ecu_corpus_stage_started',
          stage,
          jobId: job.id,
          runId: data.runId,
          workerId,
          queueLatencyMs,
          attemptsMade: job.attemptsMade,
          memory: memoryMonitor.read(),
        },
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

  worker.on('active', (job) => {
    logger.debug(
      { event: 'ecu_corpus_job_active', stage, jobId: job.id, workerId },
      'ECU corpus job active'
    );
  });
  worker.on('completed', (job, result) => {
    ecuCorpusWorkerJobs.inc({ stage, result: 'completed' });
    logger.info(
      {
        event: 'ecu_corpus_stage_completed',
        stage,
        jobId: job.id,
        runId: job.data.runId,
        workerId,
        attemptsMade: job.attemptsMade,
        result,
        memory: memoryMonitor.read(),
      },
      'ECU corpus stage completed'
    );
  });
  worker.on('failed', (job, error) => {
    ecuCorpusWorkerJobs.inc({ stage, result: 'failed' });
    recordStageMetrics({
      stage,
      status: 'failed',
      elapsedMs: job?.processedOn ? Date.now() - job.processedOn : 0,
      processedFiles: 0,
      failedFiles: 1,
    });
    logger.error(
      {
        err: error,
        event: 'ecu_corpus_stage_failed',
        stage,
        jobId: job?.id,
        runId: job?.data.runId,
        workerId,
        attemptsMade: job?.attemptsMade,
        memory: memoryMonitor.read(),
      },
      'ECU corpus stage failed'
    );
  });
  worker.on('error', (error) => {
    ecuCorpusRedisErrors.inc({ stage });
    logger.error(
      { err: error, event: 'ecu_corpus_worker_error', stage, workerId },
      'ECU corpus worker error'
    );
    void markWorkerHeartbeat(heartbeatConfig, 'ERROR', { error: error.message, stage });
  });
  worker.on('stalled', (jobId) => {
    ecuCorpusStalledJobs.inc({ stage });
    logger.warn(
      { event: 'ecu_corpus_job_stalled', stage, jobId, workerId },
      'ECU corpus job stalled'
    );
  });
  worker.on('drained', () => {
    logger.info({ event: 'ecu_corpus_queue_drained', stage, workerId }, 'ECU corpus queue drained');
  });
  workers.push(worker);
}

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  const started = Date.now();
  shuttingDown = true;
  logger.info(
    { event: 'ecu_corpus_worker_shutdown_started', signal, workerId },
    'shutting down ECU corpus workers'
  );
  stopMaintenance();
  memoryMonitor.stop();
  await markWorkerHeartbeat(heartbeatConfig, 'STOPPING', { signal, memory: memoryMonitor.read() });

  const timeoutMs = Number.parseInt(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? '30000', 10);
  const shutdownWork = Promise.allSettled([
    ...workers.map((worker) => worker.close()),
    closeEcuCorpusQueues(),
    stopHeartbeat(),
    disconnectPrismaClient(),
  ]);
  const results = await Promise.race([
    shutdownWork,
    delay(timeoutMs).then(() => 'timeout' as const),
  ]);
  const result = results === 'timeout' ? 'timeout' : 'success';
  ecuCorpusShutdownDuration.observe({ result }, (Date.now() - started) / 1000);

  if (results === 'timeout') {
    logger.error(
      { event: 'ecu_corpus_worker_shutdown_timeout', signal, workerId, timeoutMs },
      'ECU corpus worker shutdown timed out'
    );
  } else {
    for (const shutdownResult of results) {
      if (shutdownResult.status === 'rejected') {
        logger.error(
          { err: shutdownResult.reason, event: 'ecu_corpus_worker_shutdown_step_failed', workerId },
          'ECU corpus worker shutdown step failed'
        );
      }
    }
  }

  process.exit(0);
}

const selfShutdownMs = Number.parseInt(process.env.ECU_CORPUS_WORKER_SELF_SHUTDOWN_MS ?? '0', 10);
if (selfShutdownMs > 0) {
  setTimeout(() => void shutdown('SIGTERM'), selfShutdownMs).unref();
}

process.on('SIGINT', (signal) => void shutdown(signal));
process.on('SIGTERM', (signal) => void shutdown(signal));
