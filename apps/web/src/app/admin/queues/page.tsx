'use client';

import { useCleanupQueue, useQueueHealth } from '@/hooks/queries/use-admin-queues';
import { useToastContext } from '@/lib/toast/context';
import type { QueueJobCounts, WorkerHeartbeat, WorkerStatus } from '@/lib/api/admin-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelative(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ─── Worker status badge ──────────────────────────────────────────────────────

const WORKER_STATUS_COLORS: Record<WorkerStatus | 'STALE', string> = {
  ONLINE:  'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
  OFFLINE: 'border-slate-500/40  bg-slate-500/10  text-slate-400',
  STALE:   'border-amber-400/40  bg-amber-400/10  text-amber-400',
};

function WorkerBadge({ status }: { status: WorkerStatus | 'STALE' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        WORKER_STATUS_COLORS[status],
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

// ─── Queue counts card ────────────────────────────────────────────────────────

interface CountsCardProps {
  title: string;
  subtitle?: string;
  counts: QueueJobCounts;
  isPaused?: boolean;
}

function CountsCard({ title, subtitle, counts, isPaused }: CountsCardProps) {
  const slots = [
    { label: 'Waiting',   value: counts.waiting   ?? 0, color: 'text-sky-400' },
    { label: 'Active',    value: counts.active    ?? 0, color: 'text-amber-400' },
    { label: 'Completed', value: counts.completed ?? 0, color: 'text-emerald-400' },
    { label: 'Failed',    value: counts.failed    ?? 0, color: 'text-red-400' },
    { label: 'Delayed',   value: counts.delayed   ?? 0, color: 'text-violet-400' },
    { label: 'Paused',    value: counts.paused    ?? 0, color: 'text-brand-muted' },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="font-display text-sm font-bold text-brand-text">{title}</p>
        {subtitle && (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-brand-muted">
            {subtitle}
          </span>
        )}
        {isPaused && (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-400">
            ⏸ Paused
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {slots.map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className={['font-mono text-xl font-bold', color].join(' ')}>{value}</p>
            <p className="text-[10px] text-brand-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Worker card ──────────────────────────────────────────────────────────────

function WorkerCard({ worker }: { worker: WorkerHeartbeat }) {
  const eff = worker.effectiveStatus as WorkerStatus | 'STALE';
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div>
        <p className="font-mono text-xs font-medium text-brand-text">{worker.workerId}</p>
        <p className="text-[11px] text-brand-muted">
          {worker.queueName} · last seen {fmtRelative(worker.lastSeenAt)}
        </p>
      </div>
      <WorkerBadge status={eff} />
    </div>
  );
}

// ─── Cleanup button ───────────────────────────────────────────────────────────

function CleanupButton() {
  const { mutateAsync, isPending } = useCleanupQueue();
  const { addToast } = useToastContext();

  const handle = async () => {
    try {
      await mutateAsync();
      addToast({ variant: 'success', title: 'Queue cleaned up' });
    } catch {
      addToast({ variant: 'error', title: 'Cleanup failed' });
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => void handle()}
      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:border-red-400/30 hover:text-red-400 disabled:opacity-40"
    >
      {isPending ? '…' : '🗑 Cleanup Queue'}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QueuesPage() {
  const { data, isLoading, dataUpdatedAt } = useQueueHealth(10_000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-brand-text">Queue Health</h1>
          <p className="text-xs text-brand-muted">BullMQ queue status · auto-refreshes every 10 s</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-brand-muted">
              Updated {fmtRelative(new Date(dataUpdatedAt).toISOString())}
            </p>
          )}
          <CleanupButton />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-sm text-brand-muted">Failed to load queue data.</p>
      ) : (
        <>
          {/* BIN Analysis queue */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-muted">
              BIN Analysis
            </h2>
            <CountsCard
              title={data.queue.queueName}
              counts={data.queue.counts}
              isPaused={data.queue.isPaused}
            />
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Concurrency', value: String(data.queue.settings.concurrency) },
                { label: 'Max Attempts', value: String(data.queue.settings.maxAttempts) },
                { label: 'Retry Backoff', value: `${data.queue.settings.retryBackoffMs / 1000}s` },
                { label: 'Stalled After', value: `${data.queue.settings.stalledAfterMs / 1000}s` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-brand-muted">{label}</p>
                  <p className="font-mono text-sm font-bold text-brand-text">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ECU Corpus queues */}
          {data.ecuCorpusQueues.stages.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-muted">
                ECU Corpus Pipeline
              </h2>
              <div className="space-y-3">
                {data.ecuCorpusQueues.stages.map((stage) => (
                  <CountsCard
                    key={stage.queueName}
                    title={stage.queueName}
                    subtitle={stage.stage}
                    counts={stage.counts}
                    isPaused={stage.isPaused}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Workers */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Workers
              <span className="ml-2 font-mono text-brand-text">{data.workers.length}</span>
            </h2>
            {data.workers.length === 0 ? (
              <p className="text-sm text-brand-muted">No worker heartbeats recorded.</p>
            ) : (
              <div className="space-y-2">
                {data.workers.map((w) => (
                  <WorkerCard key={w.id} worker={w} />
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-brand-muted">
              Workers are marked STALE after {data.heartbeat.staleAfterMs / 1000}s of inactivity.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
