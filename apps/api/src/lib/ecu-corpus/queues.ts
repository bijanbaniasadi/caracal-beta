import { Queue, type JobsOptions } from 'bullmq';
import { setTimeout as delay } from 'node:timers/promises';

import { getRedisConnectionOptions } from '../bin-analysis/queue.js';
import { logger } from '../logger.js';
import {
  ecuCorpusQueueBackpressure,
  ecuCorpusQueueDepth,
  ecuCorpusQueueLatency,
} from '../observability/metrics.js';
import type { EcuIngestionStage, OptimizedIngestionInput } from './optimized-ingestion.js';

export const ecuCorpusQueuePrefix = process.env.ECU_CORPUS_QUEUE_PREFIX ?? 'ecu-corpus';

export interface EcuCorpusStageJobData {
  runId?: string;
  stage: EcuIngestionStage;
  input?: OptimizedIngestionInput;
}

export const ecuCorpusStages: EcuIngestionStage[] = [
  'discovery',
  'fingerprinting',
  'relation-extraction',
  'clustering',
  'signature-generation',
];

const sharedQueues = new Map<EcuIngestionStage, Queue<EcuCorpusStageJobData>>();

interface QueueRuntimeStats {
  stage: EcuIngestionStage;
  queueName: string;
  counts: Record<string, number>;
  isPaused: boolean;
  oldestWaitingAgeMs: number | null;
  backpressure: {
    enabled: boolean;
    maxDepth: number;
    currentDepth: number;
    overLimit: boolean;
  };
}

export function ecuCorpusQueueName(stage: EcuIngestionStage): string {
  return `${ecuCorpusQueuePrefix}-${stage}`;
}

function defaultJobOptions(): JobsOptions {
  return {
    attempts: Number.parseInt(process.env.ECU_CORPUS_QUEUE_ATTEMPTS ?? '3', 10),
    backoff: {
      type: 'exponential',
      delay: Number.parseInt(process.env.ECU_CORPUS_QUEUE_BACKOFF_MS ?? '30000', 10),
    },
    removeOnComplete: Number.parseInt(process.env.ECU_CORPUS_QUEUE_REMOVE_COMPLETE ?? '1000', 10),
    removeOnFail: Number.parseInt(process.env.ECU_CORPUS_QUEUE_REMOVE_FAILED ?? '5000', 10),
  };
}

export function getEcuCorpusQueue(stage: EcuIngestionStage): Queue<EcuCorpusStageJobData> {
  let queue = sharedQueues.get(stage);

  if (!queue) {
    queue = new Queue<EcuCorpusStageJobData>(ecuCorpusQueueName(stage), {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: defaultJobOptions(),
    });
    sharedQueues.set(stage, queue);
  }

  return queue;
}

function backpressureMaxDepth(): number {
  return Number.parseInt(process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_MAX_DEPTH ?? '5000', 10);
}

function isBackpressureEnabled(): boolean {
  return process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_DISABLED !== 'true';
}

async function readQueueRuntimeStats(stage: EcuIngestionStage): Promise<QueueRuntimeStats> {
  const queue = getEcuCorpusQueue(stage);
  const [counts, isPaused, oldestJobs] = await Promise.all([
    queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
      'prioritized',
      'waiting-children'
    ),
    queue.isPaused(),
    queue.getJobs(['waiting', 'delayed', 'prioritized'], 0, 0, true),
  ]);
  const maxDepth = backpressureMaxDepth();
  const currentDepth =
    (counts.waiting ?? 0) +
    (counts.delayed ?? 0) +
    (counts.prioritized ?? 0) +
    (counts['waiting-children'] ?? 0);
  const oldestWaitingAgeMs =
    oldestJobs[0]?.timestamp && currentDepth > 0 ? Date.now() - oldestJobs[0].timestamp : null;
  const stats = {
    stage,
    queueName: ecuCorpusQueueName(stage),
    counts,
    isPaused,
    oldestWaitingAgeMs,
    backpressure: {
      enabled: isBackpressureEnabled(),
      maxDepth,
      currentDepth,
      overLimit: isBackpressureEnabled() && currentDepth >= maxDepth,
    },
  };

  for (const [state, value] of Object.entries(counts)) {
    ecuCorpusQueueDepth.set({ stage, state }, value);
  }

  ecuCorpusQueueBackpressure.set({ stage }, stats.backpressure.overLimit ? 1 : 0);

  if (oldestWaitingAgeMs !== null) {
    ecuCorpusQueueLatency.observe({ stage }, oldestWaitingAgeMs / 1000);
  }

  return stats;
}

export async function closeEcuCorpusQueues(): Promise<void> {
  await Promise.all(Array.from(sharedQueues.values()).map((queue) => queue.close()));
  sharedQueues.clear();
}

export async function enqueueEcuCorpusStage(stage: EcuIngestionStage, data: EcuCorpusStageJobData) {
  await waitForEcuCorpusQueueCapacity(stage);
  const queue = getEcuCorpusQueue(stage);
  return queue.add(stage, data, {
    jobId: `${data.runId ?? 'new'}-${stage}-${Date.now()}`,
  });
}

export async function enqueueEcuCorpusPipeline(input: OptimizedIngestionInput) {
  return enqueueEcuCorpusStage('discovery', {
    stage: 'discovery',
    input,
  });
}

export async function getEcuCorpusQueueStats() {
  return Promise.all(ecuCorpusStages.map((stage) => readQueueRuntimeStats(stage)));
}

export async function waitForEcuCorpusQueueCapacity(stage: EcuIngestionStage): Promise<void> {
  if (!isBackpressureEnabled()) {
    return;
  }

  const timeoutMs = Number.parseInt(
    process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_TIMEOUT_MS ?? '30000',
    10
  );
  const pollMs = Number.parseInt(process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_POLL_MS ?? '1000', 10);
  const started = Date.now();

  while (true) {
    const stats = await readQueueRuntimeStats(stage);

    if (!stats.backpressure.overLimit) {
      return;
    }

    logger.warn(
      {
        stage,
        queueName: stats.queueName,
        currentDepth: stats.backpressure.currentDepth,
        maxDepth: stats.backpressure.maxDepth,
        oldestWaitingAgeMs: stats.oldestWaitingAgeMs,
      },
      'ECU corpus queue backpressure active'
    );

    if (Date.now() - started >= timeoutMs) {
      throw new Error(
        `ECU corpus queue backpressure timeout for ${stage}: depth=${stats.backpressure.currentDepth}`
      );
    }

    await delay(pollMs);
  }
}

export async function pauseEcuCorpusQueues(): Promise<void> {
  await Promise.all(ecuCorpusStages.map((stage) => getEcuCorpusQueue(stage).pause()));
}

export async function resumeEcuCorpusQueues(): Promise<void> {
  await Promise.all(ecuCorpusStages.map((stage) => getEcuCorpusQueue(stage).resume()));
}

export async function resetFailedEcuCorpusQueueJobs(): Promise<
  Array<{ stage: EcuIngestionStage; cleaned: string[] }>
> {
  return Promise.all(
    ecuCorpusStages.map(async (stage) => {
      const queue = getEcuCorpusQueue(stage);
      const cleaned = await queue.clean(
        Number.parseInt(process.env.ECU_CORPUS_FAILED_JOB_GRACE_MS ?? '0', 10),
        Number.parseInt(process.env.ECU_CORPUS_FAILED_JOB_CLEAN_LIMIT ?? '1000', 10),
        'failed'
      );

      return { stage, cleaned };
    })
  );
}

export async function cleanEcuCorpusQueues(
  input: {
    failedRetentionMs?: number;
    completedRetentionMs?: number;
    limit?: number;
  } = {}
): Promise<Array<{ stage: EcuIngestionStage; failed: number; completed: number }>> {
  const failedRetentionMs =
    input.failedRetentionMs ??
    Number.parseInt(
      process.env.ECU_CORPUS_FAILED_JOB_RETENTION_MS ?? String(7 * 24 * 60 * 60 * 1000),
      10
    );
  const completedRetentionMs =
    input.completedRetentionMs ??
    Number.parseInt(
      process.env.ECU_CORPUS_COMPLETED_JOB_RETENTION_MS ?? String(24 * 60 * 60 * 1000),
      10
    );
  const limit =
    input.limit ?? Number.parseInt(process.env.ECU_CORPUS_QUEUE_CLEAN_LIMIT ?? '1000', 10);

  return Promise.all(
    ecuCorpusStages.map(async (stage) => {
      const queue = getEcuCorpusQueue(stage);
      const [failed, completed] = await Promise.all([
        queue.clean(failedRetentionMs, limit, 'failed'),
        queue.clean(completedRetentionMs, limit, 'completed'),
      ]);

      return { stage, failed: failed.length, completed: completed.length };
    })
  );
}

export function startEcuCorpusQueueMaintenanceCron(): () => void {
  let running = false;
  const intervalMs = Number.parseInt(process.env.ECU_CORPUS_CLEANUP_INTERVAL_MS ?? '900000', 10);

  const tick = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      const cleanup = await cleanEcuCorpusQueues();
      logger.info({ cleanup }, 'ECU corpus queue maintenance completed');
    } catch (error) {
      logger.error({ err: error }, 'ECU corpus queue maintenance failed');
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
