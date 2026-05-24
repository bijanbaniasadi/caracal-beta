import 'dotenv/config';

import { disconnectPrismaClient } from '@caracal/db';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  discoverCorpusOptimized,
  runOptimizedCorpusIngestion,
} from '../src/lib/ecu-corpus/optimized-ingestion.js';
import {
  closeEcuCorpusQueues,
  enqueueEcuCorpusPipeline,
  getEcuCorpusQueueStats,
} from '../src/lib/ecu-corpus/queues.js';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function intArg(name: string, fallback: number): number {
  const value = argValue(name);
  return value ? Number.parseInt(value, 10) : fallback;
}

async function createSimulatedCorpus(input: {
  files: number;
  sizeBytes: number;
  root?: string;
}): Promise<string> {
  const root = input.root ?? (await mkdtemp(path.join(os.tmpdir(), 'caracal-ecu-corpus-sim-')));
  const extensions = ['.bin', '.ori', '.mod', '.a2l', '.txt', '.hex', '.unknown'];

  for (let index = 0; index < input.files; index += 1) {
    const dir = path.join(root, `family-${index % 20}`, `project-${index % 100}`);
    await mkdir(dir, { recursive: true });
    const extension = extensions[index % extensions.length];
    const buffer = Buffer.alloc(input.sizeBytes);
    randomBytes(Math.min(input.sizeBytes, 256)).copy(buffer);
    buffer.write(`SIM-FILE-${index}-BOSCH-EDC17-${index % 5}`, 0, 'ascii');
    await writeFile(path.join(dir, `sample-${String(index).padStart(6, '0')}${extension}`), buffer);
  }

  return root;
}

async function runStress() {
  const generatedRoot = !argValue('root');
  const rootPath =
    argValue('root') ??
    (await createSimulatedCorpus({
      files: intArg('simulate-files', 1000),
      sizeBytes: intArg('simulate-size-bytes', 2048),
    }));
  const durationMs = intArg('duration-ms', 60_000);
  const maxFiles = intArg('max-files', 500);
  const batchSize = intArg('batch-size', 500);
  const fingerprintBatchSize = intArg('fingerprint-batch-size', 50);
  const started = Date.now();
  const runs: unknown[] = [];

  try {
    do {
      runs.push(
        await runOptimizedCorpusIngestion({
          rootPath,
          maxFiles,
          batchSize,
          fingerprintBatchSize,
          maxAnalysisBytes: intArg('max-analysis-bytes', 65536),
        })
      );
    } while (Date.now() - started < durationMs);

    console.log(
      JSON.stringify(
        {
          rootPath,
          durationMs: Date.now() - started,
          runs,
          queueStats: await getEcuCorpusQueueStats(),
          memoryUsage: process.memoryUsage(),
        },
        null,
        2
      )
    );
  } finally {
    if (generatedRoot && argValue('keep') !== 'true') {
      await rm(rootPath, { recursive: true, force: true });
    }
  }
}

async function runFailureInjection() {
  const mode = argValue('mode') ?? 'bad-root';

  if (mode === 'bad-root') {
    const rootPath = path.join(os.tmpdir(), `missing-corpus-${Date.now()}`);

    try {
      await discoverCorpusOptimized({ rootPath, maxFiles: 10 });
      throw new Error('bad-root injection unexpectedly succeeded');
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            mode,
            expectedFailure: true,
            error: error instanceof Error ? error.message : 'unknown',
          },
          null,
          2
        )
      );
    }
    return;
  }

  if (mode === 'backpressure') {
    process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_MAX_DEPTH = '0';
    process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_TIMEOUT_MS = '100';
    process.env.ECU_CORPUS_QUEUE_BACKPRESSURE_POLL_MS = '25';

    try {
      await enqueueEcuCorpusPipeline({ maxFiles: 1 });
      throw new Error('backpressure injection unexpectedly succeeded');
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            mode,
            expectedFailure: true,
            error: error instanceof Error ? error.message : 'unknown',
          },
          null,
          2
        )
      );
    }
    return;
  }

  throw new Error(`Unknown failure injection mode: ${mode}`);
}

async function validateGracefulShutdown() {
  const timeoutMs = intArg('timeout-ms', 10_000);
  const distWorker = path.resolve(process.cwd(), 'dist/workers/ecu-corpus-worker.js');
  const workerArgs = await access(distWorker)
    .then(() => [distWorker])
    .catch(() => ['--import', 'tsx', 'src/workers/ecu-corpus-worker.ts']);
  const child = spawn(process.execPath, workerArgs, {
    cwd: path.resolve(process.cwd()),
    env: {
      ...process.env,
      ECU_CORPUS_WORKER_CONCURRENCY: '1',
      ECU_CORPUS_WORKER_SELF_SHUTDOWN_MS: String(intArg('warmup-ms', 5000)),
      WORKER_SHUTDOWN_TIMEOUT_MS: String(timeoutMs),
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output: string[] = [];

  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));

  const result = await Promise.race([
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.on('exit', (code, signal) => resolve({ code, signal }));
    }),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs + 3000)),
  ]);

  if (result === 'timeout') {
    child.kill('SIGKILL');
  }

  console.log(
    JSON.stringify(
      {
        graceful: result !== 'timeout' && result.code === 0,
        signalSent: 'self-shutdown',
        result,
        outputTail: output.join('').slice(-2000),
      },
      null,
      2
    )
  );
}

async function validateCrashRecovery() {
  const timeoutMs = intArg('timeout-ms', 10_000);
  const distWorker = path.resolve(process.cwd(), 'dist/workers/ecu-corpus-worker.js');
  const workerArgs = await access(distWorker)
    .then(() => [distWorker])
    .catch(() => ['--import', 'tsx', 'src/workers/ecu-corpus-worker.ts']);
  const env = {
    ...process.env,
    ECU_CORPUS_WORKER_CONCURRENCY: '1',
    WORKER_SHUTDOWN_TIMEOUT_MS: String(timeoutMs),
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
  };

  const crashed = spawn(process.execPath, workerArgs, {
    cwd: path.resolve(process.cwd()),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve) => setTimeout(resolve, intArg('crash-after-ms', 2500)));
  crashed.kill('SIGKILL');
  const crashResult = await Promise.race([
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      crashed.on('exit', (code, signal) => resolve({ code, signal }));
    }),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 3000)),
  ]);

  const replacement = spawn(process.execPath, workerArgs, {
    cwd: path.resolve(process.cwd()),
    env: {
      ...env,
      ECU_CORPUS_WORKER_SELF_SHUTDOWN_MS: String(intArg('replacement-ms', 3000)),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const replacementResult = await Promise.race([
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      replacement.on('exit', (code, signal) => resolve({ code, signal }));
    }),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs + 3000)),
  ]);

  if (replacementResult === 'timeout') {
    replacement.kill('SIGKILL');
  }

  console.log(
    JSON.stringify(
      {
        crashed: crashResult !== 'timeout',
        crashResult,
        replacementRecovered:
          replacementResult !== 'timeout' &&
          replacementResult.code === 0 &&
          !replacementResult.signal,
        replacementResult,
        queueStats: await getEcuCorpusQueueStats(),
      },
      null,
      2
    )
  );
}

async function main() {
  const command = process.argv[2] ?? 'stress';

  if (command === 'simulate-corpus') {
    const rootPath = await createSimulatedCorpus({
      files: intArg('files', 1000),
      sizeBytes: intArg('size-bytes', 2048),
      root: argValue('root'),
    });
    console.log(JSON.stringify({ rootPath }, null, 2));
    return;
  }

  if (command === 'stress') {
    await runStress();
    return;
  }

  if (command === 'failure-injection') {
    await runFailureInjection();
    return;
  }

  if (command === 'graceful-shutdown') {
    await validateGracefulShutdown();
    return;
  }

  if (command === 'crash-recovery') {
    await validateCrashRecovery();
    return;
  }

  if (command === 'queue-snapshot') {
    console.log(JSON.stringify(await getEcuCorpusQueueStats(), null, 2));
    return;
  }

  throw new Error(`Unknown reliability command: ${command}`);
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
