import { logger } from '../logger.js';
import { ecuCorpusMemoryLeakWarnings, setWorkerMemory } from './metrics.js';

interface MemorySample {
  sampledAt: number;
  rss: number;
  heapUsed: number;
  external: number;
}

export interface MemoryMonitorOptions {
  workerId: string;
  intervalMs?: number;
  warningRssBytes?: number;
  leakWindowSize?: number;
  leakGrowthBytes?: number;
}

export interface MemoryMonitorSnapshot {
  usage: NodeJS.MemoryUsage;
  rssGrowthBytes: number;
  sampleCount: number;
  possibleLeak: boolean;
}

function snapshot(): MemorySample {
  const usage = process.memoryUsage();

  return {
    sampledAt: Date.now(),
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    external: usage.external,
  };
}

export function startMemoryMonitor(options: MemoryMonitorOptions): {
  stop: () => void;
  read: () => MemoryMonitorSnapshot;
} {
  const intervalMs =
    options.intervalMs ??
    Number.parseInt(process.env.RUNTIME_MEMORY_SAMPLE_INTERVAL_MS ?? '15000', 10);
  const warningRssBytes =
    options.warningRssBytes ??
    Number.parseInt(process.env.RUNTIME_MEMORY_WARNING_RSS_BYTES ?? String(1024 * 1024 * 1024), 10);
  const leakWindowSize =
    options.leakWindowSize ?? Number.parseInt(process.env.RUNTIME_MEMORY_LEAK_WINDOW ?? '8', 10);
  const leakGrowthBytes =
    options.leakGrowthBytes ??
    Number.parseInt(process.env.RUNTIME_MEMORY_LEAK_GROWTH_BYTES ?? String(128 * 1024 * 1024), 10);
  const samples: MemorySample[] = [];

  const read = (): MemoryMonitorSnapshot => {
    const usage = process.memoryUsage();
    const first = samples[0];
    const last = samples[samples.length - 1];
    const rssGrowthBytes = first && last ? last.rss - first.rss : 0;

    return {
      usage,
      rssGrowthBytes,
      sampleCount: samples.length,
      possibleLeak: samples.length >= leakWindowSize && rssGrowthBytes >= leakGrowthBytes,
    };
  };

  const collect = () => {
    const sample = snapshot();
    samples.push(sample);

    while (samples.length > leakWindowSize) {
      samples.shift();
    }

    setWorkerMemory(options.workerId, process.memoryUsage());

    const current = read();
    if (sample.rss >= warningRssBytes || current.possibleLeak) {
      if (current.possibleLeak) {
        ecuCorpusMemoryLeakWarnings.inc({ worker_id: options.workerId });
      }

      logger.warn(
        {
          workerId: options.workerId,
          memoryUsage: current.usage,
          rssGrowthBytes: current.rssGrowthBytes,
          warningRssBytes,
          leakGrowthBytes,
          sampleCount: current.sampleCount,
          possibleLeak: current.possibleLeak,
        },
        'runtime memory pressure observed'
      );
    }
  };

  collect();
  const timer = setInterval(collect, intervalMs);
  timer.unref();

  return {
    stop: () => clearInterval(timer),
    read,
  };
}
