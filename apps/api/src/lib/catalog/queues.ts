import { Queue, type JobsOptions } from 'bullmq';

import { getRedisConnectionOptions } from '../bin-analysis/queue.js';

export const catalogQueueNames = {
  ingestion: process.env.CATALOG_INGESTION_QUEUE_NAME ?? 'ingestion',
  fingerprint: process.env.CATALOG_FINGERPRINT_QUEUE_NAME ?? 'fingerprint',
  imagePipeline: process.env.CATALOG_IMAGE_PIPELINE_QUEUE_NAME ?? 'image-pipeline',
  projection: process.env.CATALOG_PROJECTION_QUEUE_NAME ?? 'projection',
  searchIndex: process.env.CATALOG_SEARCH_INDEX_QUEUE_NAME ?? 'search-index',
  reconciliation: process.env.CATALOG_RECONCILIATION_QUEUE_NAME ?? 'reconciliation',
} as const;

export interface CatalogIngestionJobData {
  vendorSourceId: string;
  requestedBy?: string;
  trigger: 'schedule' | 'manual';
}

export interface CatalogFingerprintJobData {
  ingestionRunId?: string;
  rawProductId?: string;
}

export interface CatalogImagePipelineJobData {
  rawImageIds: string[];
  masterProductId: string;
  requestedBy: string;
}

export interface CatalogProjectionJobData {
  type: 'refresh-matview' | 'project-product' | 'full-reindex';
  masterProductId?: string;
  publicId?: string;
  reason?: string;
}

export interface CatalogSearchIndexJobData {
  type: 'upsert' | 'delete' | 'reindex-full';
  masterProductId?: string;
  publicId?: string;
  reason?: string;
}

export interface CatalogReconciliationJobData {
  type: 'projection-consistency' | 'search-count' | 'full-reconcile';
  reason?: string;
}

let ingestionQueue: Queue<CatalogIngestionJobData> | null = null;
let fingerprintQueue: Queue<CatalogFingerprintJobData> | null = null;
let imagePipelineQueue: Queue<CatalogImagePipelineJobData> | null = null;
let projectionQueue: Queue<CatalogProjectionJobData> | null = null;
let searchIndexQueue: Queue<CatalogSearchIndexJobData> | null = null;
let reconciliationQueue: Queue<CatalogReconciliationJobData> | null = null;

function catalogDefaultJobOptions(): JobsOptions {
  return {
    attempts: Number.parseInt(process.env.CATALOG_QUEUE_ATTEMPTS ?? '3', 10),
    backoff: {
      type: 'exponential',
      delay: Number.parseInt(process.env.CATALOG_QUEUE_BACKOFF_MS ?? '30000', 10),
    },
    removeOnComplete: Number.parseInt(process.env.CATALOG_QUEUE_REMOVE_COMPLETE ?? '1000', 10),
    removeOnFail: Number.parseInt(process.env.CATALOG_QUEUE_REMOVE_FAILED ?? '5000', 10),
  };
}

export function getCatalogIngestionQueue(): Queue<CatalogIngestionJobData> {
  ingestionQueue ??= new Queue<CatalogIngestionJobData>(catalogQueueNames.ingestion, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: catalogDefaultJobOptions(),
  });

  return ingestionQueue;
}

export function getCatalogFingerprintQueue(): Queue<CatalogFingerprintJobData> {
  fingerprintQueue ??= new Queue<CatalogFingerprintJobData>(catalogQueueNames.fingerprint, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: catalogDefaultJobOptions(),
  });

  return fingerprintQueue;
}

export function getCatalogImagePipelineQueue(): Queue<CatalogImagePipelineJobData> {
  imagePipelineQueue ??= new Queue<CatalogImagePipelineJobData>(catalogQueueNames.imagePipeline, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: catalogDefaultJobOptions(),
  });

  return imagePipelineQueue;
}

export function getCatalogProjectionQueue(): Queue<CatalogProjectionJobData> {
  projectionQueue ??= new Queue<CatalogProjectionJobData>(catalogQueueNames.projection, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: catalogDefaultJobOptions(),
  });

  return projectionQueue;
}

export function getCatalogSearchIndexQueue(): Queue<CatalogSearchIndexJobData> {
  searchIndexQueue ??= new Queue<CatalogSearchIndexJobData>(catalogQueueNames.searchIndex, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: catalogDefaultJobOptions(),
  });

  return searchIndexQueue;
}

export function getCatalogReconciliationQueue(): Queue<CatalogReconciliationJobData> {
  reconciliationQueue ??= new Queue<CatalogReconciliationJobData>(
    catalogQueueNames.reconciliation,
    {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: catalogDefaultJobOptions(),
    }
  );

  return reconciliationQueue;
}

export function getCatalogQueues(): Array<Queue> {
  return [
    getCatalogIngestionQueue(),
    getCatalogFingerprintQueue(),
    getCatalogImagePipelineQueue(),
    getCatalogProjectionQueue(),
    getCatalogSearchIndexQueue(),
    getCatalogReconciliationQueue(),
  ];
}

export async function enqueueCatalogProjectionJob(data: CatalogProjectionJobData) {
  const jobName = data.type;

  return getCatalogProjectionQueue().add(jobName, data, {
    jobId: `${jobName}:${data.masterProductId ?? data.publicId ?? 'all'}:${Date.now()}`,
  });
}

export async function enqueueCatalogSearchIndexJob(data: CatalogSearchIndexJobData) {
  const jobName = data.type;

  return getCatalogSearchIndexQueue().add(jobName, data, {
    jobId: `${jobName}:${data.masterProductId ?? data.publicId ?? 'all'}:${Date.now()}`,
  });
}

export async function enqueueCatalogReconciliationJob(data: CatalogReconciliationJobData) {
  const jobName = data.type;

  return getCatalogReconciliationQueue().add(jobName, data, {
    jobId: `${jobName}:${Date.now()}`,
  });
}

export async function closeCatalogQueues(): Promise<void> {
  await Promise.all(
    [
      ingestionQueue,
      fingerprintQueue,
      imagePipelineQueue,
      projectionQueue,
      searchIndexQueue,
      reconciliationQueue,
    ].map((queue) => queue?.close())
  );

  ingestionQueue = null;
  fingerprintQueue = null;
  imagePipelineQueue = null;
  projectionQueue = null;
  searchIndexQueue = null;
  reconciliationQueue = null;
}
