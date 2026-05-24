import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';

import {
  discoverCorpusOptimized,
  extractRelationsOptimized,
  getIngestionBottleneckReport,
  fingerprintCorpusOptimized,
  getOptimizedCorpusMetrics,
  pauseOptimizedIngestion,
  rebuildClustersOptimized,
  rebuildSignaturesOptimized,
  resetFailedOptimizedJobs,
  resumeOptimizedIngestion,
  runOptimizedCorpusIngestion,
  verifyCorpusIntegrity,
} from '../src/lib/ecu-corpus/optimized-ingestion.js';
import {
  closeEcuCorpusQueues,
  enqueueEcuCorpusPipeline,
  getEcuCorpusQueueStats,
  pauseEcuCorpusQueues,
  resetFailedEcuCorpusQueueJobs,
  resumeEcuCorpusQueues,
} from '../src/lib/ecu-corpus/queues.js';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function intArg(name: string): number | undefined {
  const value = argValue(name);
  return value ? Number.parseInt(value, 10) : undefined;
}

async function main() {
  const command = process.argv[2] ?? 'scan';
  const runId = argValue('run-id');
  const input = {
    runId,
    rootPath: argValue('root'),
    maxFiles: intArg('max-files'),
    batchSize: intArg('batch-size'),
    fingerprintBatchSize: intArg('fingerprint-batch-size'),
    maxAnalysisBytes: intArg('max-analysis-bytes'),
    resume: command === 'resume',
  };

  if (command === 'scan') {
    console.log(JSON.stringify(await runOptimizedCorpusIngestion(input), null, 2));
    return;
  }

  if (command === 'enqueue') {
    const job = await enqueueEcuCorpusPipeline(input);
    console.log(JSON.stringify({ queued: true, jobId: job.id, queueName: job.queueName }, null, 2));
    return;
  }

  if (command === 'discover') {
    console.log(JSON.stringify(await discoverCorpusOptimized(input), null, 2));
    return;
  }

  if (command === 'fingerprint') {
    if (!runId) throw new Error('--run-id is required for fingerprint');
    console.log(
      JSON.stringify(
        await fingerprintCorpusOptimized({
          runId,
          batchSize: input.fingerprintBatchSize,
          maxAnalysisBytes: input.maxAnalysisBytes,
          limit: input.maxFiles,
        }),
        null,
        2
      )
    );
    return;
  }

  if (command === 'extract-relations') {
    if (!runId) throw new Error('--run-id is required for extract-relations');
    console.log(
      JSON.stringify(
        await extractRelationsOptimized({
          runId,
          batchSize: input.batchSize,
          limit: input.maxFiles,
        }),
        null,
        2
      )
    );
    return;
  }

  if (command === 'resume') {
    if (!runId) throw new Error('--run-id is required for resume');
    await resumeOptimizedIngestion(runId);
    await resumeEcuCorpusQueues();
    console.log(JSON.stringify(await runOptimizedCorpusIngestion(input), null, 2));
    return;
  }

  if (command === 'pause') {
    if (!runId) throw new Error('--run-id is required for pause');
    await pauseOptimizedIngestion(runId);
    await pauseEcuCorpusQueues();
    console.log(JSON.stringify({ paused: true, runId }, null, 2));
    return;
  }

  if (command === 'reset-failed') {
    if (!runId) throw new Error('--run-id is required for reset-failed');
    await resetFailedOptimizedJobs(runId);
    const queues = await resetFailedEcuCorpusQueueJobs();
    console.log(JSON.stringify({ resetFailed: true, runId, queues }, null, 2));
    return;
  }

  if (command === 'rebuild-clusters') {
    if (!runId) throw new Error('--run-id is required for rebuild-clusters');
    console.log(JSON.stringify(await rebuildClustersOptimized(runId), null, 2));
    return;
  }

  if (command === 'rebuild-signatures') {
    if (!runId) throw new Error('--run-id is required for rebuild-signatures');
    console.log(JSON.stringify(await rebuildSignaturesOptimized(runId), null, 2));
    return;
  }

  if (command === 'verify') {
    console.log(JSON.stringify(await verifyCorpusIntegrity(runId), null, 2));
    return;
  }

  if (command === 'metrics') {
    console.log(
      JSON.stringify(
        {
          corpus: await getOptimizedCorpusMetrics(runId),
          queues: await getEcuCorpusQueueStats(),
        },
        null,
        2
      )
    );
    return;
  }

  if (command === 'bottlenecks') {
    console.log(JSON.stringify(await getIngestionBottleneckReport(runId), null, 2));
    return;
  }

  if (command === 'benchmark') {
    const started = Date.now();
    const summary = (await runOptimizedCorpusIngestion({
      ...input,
      maxFiles: input.maxFiles ?? 5000,
      batchSize: input.batchSize ?? 1000,
      fingerprintBatchSize: input.fingerprintBatchSize ?? 100,
      maxAnalysisBytes: input.maxAnalysisBytes ?? 65536,
    })) as {
      stages: {
        discovery: {
          processedFiles: number;
          elapsedMs: number;
          filesPerSecond: number;
        };
      };
    };
    const elapsedMs = Date.now() - started;
    console.log(
      JSON.stringify(
        {
          ...summary,
          benchmark: {
            elapsedMs,
            filesPerSecond:
              summary.stages.discovery.processedFiles /
              Math.max(summary.stages.discovery.elapsedMs / 1000, 0.001),
            estimatedFullScanHours:
              320000 / Math.max(summary.stages.discovery.filesPerSecond, 0.001) / 3600,
          },
        },
        null,
        2
      )
    );
    return;
  }

  throw new Error(`Unknown ECU corpus runtime command: ${command}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeEcuCorpusQueues();
    await disconnectPrismaClient();
  });
