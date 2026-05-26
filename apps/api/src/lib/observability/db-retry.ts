import { Prisma } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';

import { logger } from '../logger.js';
import { dbOperationDuration, dbRetryTotal } from './metrics.js';

export interface RuntimeRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function isRetriableDatabaseError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034'].includes(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /connection|timeout|timed out|deadlock|write conflict|could not serialize|ECONNRESET|ECONNREFUSED/i.test(
    error.message
  );
}

function retryDelayMs(attempt: number, options: Required<RuntimeRetryOptions>): number {
  const exponential = Math.min(
    options.baseDelayMs * 2 ** Math.max(attempt - 1, 0),
    options.maxDelayMs
  );
  const jitter = Math.floor(Math.random() * Math.min(exponential, 250));
  return exponential + jitter;
}

function errorReason(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  return error instanceof Error ? error.name : 'unknown';
}

export async function withDbRetry<T>(
  operation: string,
  run: () => Promise<T>,
  options: RuntimeRetryOptions = {}
): Promise<T> {
  const settings = {
    attempts: Math.max(
      1,
      options.attempts ?? Number.parseInt(process.env.DB_RUNTIME_RETRY_ATTEMPTS ?? '3', 10)
    ),
    baseDelayMs:
      options.baseDelayMs ?? Number.parseInt(process.env.DB_RUNTIME_RETRY_BASE_MS ?? '100', 10),
    maxDelayMs:
      options.maxDelayMs ?? Number.parseInt(process.env.DB_RUNTIME_RETRY_MAX_MS ?? '2000', 10),
  };
  const started = Date.now();
  let attempt = 0;

  while (attempt < settings.attempts) {
    attempt += 1;

    try {
      const result = await run();
      dbOperationDuration.observe({ operation, status: 'success' }, (Date.now() - started) / 1000);
      return result;
    } catch (error) {
      const retriable = isRetriableDatabaseError(error);

      if (!retriable || attempt >= settings.attempts) {
        dbOperationDuration.observe({ operation, status: 'failed' }, (Date.now() - started) / 1000);
        throw error;
      }

      const sleepMs = retryDelayMs(attempt, settings);
      dbRetryTotal.inc({ operation, reason: errorReason(error) });
      logger.warn(
        {
          err: error,
          operation,
          attempt,
          maxAttempts: settings.attempts,
          sleepMs,
        },
        'database operation retry scheduled'
      );
      await delay(sleepMs);
    }
  }

  throw new Error(`Database operation ${operation} failed without a captured error.`);
}
