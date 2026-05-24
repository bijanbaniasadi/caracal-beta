import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
  type Metric,
} from 'prom-client';

import type { EcuIngestionStage } from '../ecu-corpus/optimized-ingestion.js';

export const metricsRegister = new Registry();

collectDefaultMetrics({
  register: metricsRegister,
  prefix: 'caracal_api_',
});

function registerMetric<T extends Metric<string>>(metric: T): T {
  metricsRegister.registerMetric(metric);
  return metric;
}

export const httpRequestDuration = registerMetric(
  new Histogram({
    name: 'caracal_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  })
);

export const dbOperationDuration = registerMetric(
  new Histogram({
    name: 'caracal_db_operation_duration_seconds',
    help: 'Database operation duration in seconds.',
    labelNames: ['operation', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  })
);

export const dbRetryTotal = registerMetric(
  new Counter({
    name: 'caracal_db_retry_total',
    help: 'Database retry attempts by operation.',
    labelNames: ['operation', 'reason'],
  })
);

export const ecuCorpusStageDuration = registerMetric(
  new Histogram({
    name: 'caracal_ecu_corpus_stage_duration_seconds',
    help: 'ECU corpus ingestion stage duration in seconds.',
    labelNames: ['stage', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300, 900, 1800],
  })
);

export const ecuCorpusStageFiles = registerMetric(
  new Counter({
    name: 'caracal_ecu_corpus_stage_files_total',
    help: 'ECU corpus files processed by stage and result.',
    labelNames: ['stage', 'result'],
  })
);

export const ecuCorpusFilesPerSecond = registerMetric(
  new Gauge({
    name: 'caracal_ecu_corpus_files_per_second',
    help: 'Latest ECU corpus throughput by stage.',
    labelNames: ['stage'],
  })
);

export const ecuCorpusQueueDepth = registerMetric(
  new Gauge({
    name: 'caracal_ecu_corpus_queue_depth',
    help: 'ECU corpus BullMQ queue depth by stage and state.',
    labelNames: ['stage', 'state'],
  })
);

export const ecuCorpusQueueLatency = registerMetric(
  new Histogram({
    name: 'caracal_ecu_corpus_queue_latency_seconds',
    help: 'Time an ECU corpus job waited before processing.',
    labelNames: ['stage'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 300, 900],
  })
);

export const ecuCorpusQueueBackpressure = registerMetric(
  new Gauge({
    name: 'caracal_ecu_corpus_queue_backpressure',
    help: 'Whether a queue stage is above configured backpressure depth.',
    labelNames: ['stage'],
  })
);

export const ecuCorpusWorkerJobs = registerMetric(
  new Counter({
    name: 'caracal_ecu_corpus_worker_jobs_total',
    help: 'ECU corpus worker jobs by stage and result.',
    labelNames: ['stage', 'result'],
  })
);

export const ecuCorpusWorkerMemory = registerMetric(
  new Gauge({
    name: 'caracal_ecu_corpus_worker_memory_bytes',
    help: 'ECU corpus worker memory usage by field.',
    labelNames: ['worker_id', 'field'],
  })
);

export const ecuCorpusMemoryLeakWarnings = registerMetric(
  new Counter({
    name: 'caracal_ecu_corpus_memory_leak_warnings_total',
    help: 'Potential memory leak warnings emitted by ECU corpus workers.',
    labelNames: ['worker_id'],
  })
);

export const ecuCorpusStalledJobs = registerMetric(
  new Counter({
    name: 'caracal_ecu_corpus_stalled_jobs_total',
    help: 'BullMQ stalled job events observed by ECU corpus workers.',
    labelNames: ['stage'],
  })
);

export const ecuCorpusRedisErrors = registerMetric(
  new Counter({
    name: 'caracal_ecu_corpus_redis_errors_total',
    help: 'Redis/BullMQ errors observed by ECU corpus workers.',
    labelNames: ['stage'],
  })
);

export const ecuCorpusShutdownDuration = registerMetric(
  new Histogram({
    name: 'caracal_ecu_corpus_shutdown_duration_seconds',
    help: 'ECU corpus worker graceful shutdown duration in seconds.',
    labelNames: ['result'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  })
);

export function recordStageMetrics(input: {
  stage: EcuIngestionStage;
  status: 'success' | 'failed' | 'paused';
  elapsedMs: number;
  processedFiles: number;
  skippedFiles?: number;
  failedFiles?: number;
  filesPerSecond?: number;
}): void {
  ecuCorpusStageDuration.observe(
    { stage: input.stage, status: input.status },
    input.elapsedMs / 1000
  );
  ecuCorpusStageFiles.inc({ stage: input.stage, result: 'processed' }, input.processedFiles);
  ecuCorpusStageFiles.inc({ stage: input.stage, result: 'skipped' }, input.skippedFiles ?? 0);
  ecuCorpusStageFiles.inc({ stage: input.stage, result: 'failed' }, input.failedFiles ?? 0);

  if (typeof input.filesPerSecond === 'number') {
    ecuCorpusFilesPerSecond.set({ stage: input.stage }, input.filesPerSecond);
  }
}

export function setWorkerMemory(workerId: string, usage = process.memoryUsage()): void {
  for (const [field, value] of Object.entries(usage)) {
    ecuCorpusWorkerMemory.set({ worker_id: workerId, field }, value);
  }
}

export async function prometheusMetricsText(): Promise<string> {
  return metricsRegister.metrics();
}

export function prometheusContentType(): string {
  return metricsRegister.contentType;
}
