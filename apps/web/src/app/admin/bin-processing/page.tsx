'use client';

import { useState } from 'react';
import { useAdminBinJobs, useRetryBinJob } from '@/hooks/queries/use-admin-bin-jobs';
import { useQueueHealth } from '@/hooks/queries/use-admin-queues';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import {
  AdminTable,
  AdminTbody,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTableEmpty,
  AdminPagination,
} from '@/components/admin/ui/admin-table';
import { useToastContext } from '@/lib/toast/context';
import type { BinAnalysisJobStatus } from '@/lib/api/admin-types';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<BinAnalysisJobStatus, string> = {
  PENDING:   'border-slate-500/40 bg-slate-500/10 text-slate-400',
  QUEUED:    'border-sky-500/40  bg-sky-500/10  text-sky-400',
  RUNNING:   'border-amber-400/40 bg-amber-400/10 text-amber-400',
  COMPLETED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
  FAILED:    'border-red-400/40 bg-red-400/10 text-red-400',
  CANCELLED: 'border-white/20 bg-white/5 text-brand-muted',
};

function JobStatusBadge({ status }: { status: BinAnalysisJobStatus }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        STATUS_COLORS[status],
      ].join(' ')}
    >
      {status}
    </span>
  );
}

// ─── Queue stats strip ────────────────────────────────────────────────────────

function QueueStrip() {
  const { data, isLoading } = useQueueHealth(15_000);
  if (isLoading) return null;
  const q = data?.queue;
  if (!q) return null;
  const counts = q.counts;
  const stats = [
    { label: 'Waiting',   value: counts.waiting ?? 0,   color: 'text-sky-400' },
    { label: 'Active',    value: counts.active ?? 0,    color: 'text-amber-400' },
    { label: 'Completed', value: counts.completed ?? 0, color: 'text-emerald-400' },
    { label: 'Failed',    value: counts.failed ?? 0,    color: 'text-red-400' },
    { label: 'Delayed',   value: counts.delayed ?? 0,   color: 'text-violet-400' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
        {q.queueName}
      </p>
      {q.isPaused && (
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs text-amber-400">
          ⏸ Paused
        </span>
      )}
      {stats.map(({ label, value, color }) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <span className={['font-mono text-base font-bold', color].join(' ')}>
            {value}
          </span>
          <span className="text-xs text-brand-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Status filter ────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: BinAnalysisJobStatus | ''; label: string }[] = [
  { value: '',          label: 'All' },
  { value: 'PENDING',   label: 'Pending' },
  { value: 'QUEUED',    label: 'Queued' },
  { value: 'RUNNING',   label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED',    label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// ─── Row actions ──────────────────────────────────────────────────────────────

function RetryButton({ jobId }: { jobId: string }) {
  const { mutateAsync, isPending } = useRetryBinJob();
  const { addToast } = useToastContext();

  const handle = async () => {
    try {
      await mutateAsync({ id: jobId });
      addToast({ variant: 'success', title: 'Job re-queued' });
    } catch {
      addToast({ variant: 'error', title: 'Retry failed' });
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => void handle()}
      className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-amber-400/30 hover:text-amber-400 disabled:opacity-40"
    >
      {isPending ? '…' : '↺ Retry'}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BinProcessingPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<BinAnalysisJobStatus | ''>('');

  const { data, isLoading } = useAdminBinJobs(
    { page, pageSize: 25, status: statusFilter || undefined },
    8_000,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-brand-text">BIN Processing</h1>
          <p className="text-xs text-brand-muted">Analysis job queue &amp; results</p>
        </div>
        <p className="ml-auto text-sm text-brand-muted">
          {isLoading ? '…' : `${data?.total ?? 0} jobs`}
        </p>
      </div>

      {/* Queue stats */}
      <QueueStrip />

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => { setStatusFilter(value); setPage(1); }}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === value
                ? 'border-brand-orange/50 bg-brand-orange/15 text-brand-orange'
                : 'border-white/10 text-brand-muted hover:border-white/20 hover:text-brand-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <AdminTableSkeleton rows={8} cols={6} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Job ID</AdminTh>
                <AdminTh>File</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Attempts</AdminTh>
                <AdminTh>Started</AdminTh>
                <AdminTh>Completed</AdminTh>
                <AdminTh className="text-right">Actions</AdminTh>
              </tr>
            </AdminThead>

            {(data?.items.length ?? 0) === 0 ? (
              <AdminTableEmpty message="No jobs found" colSpan={7} />
            ) : (
              <AdminTbody>
                {data?.items.map((job) => (
                  <tr key={job.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <AdminTd>
                      <code className="font-mono text-[11px] text-brand-muted">
                        {job.id.slice(0, 12)}…
                      </code>
                    </AdminTd>
                    <AdminTd>
                      {job.upload ? (
                        <div>
                          <p className="max-w-[180px] truncate text-xs font-medium text-brand-text">
                            {job.upload.originalFileName}
                          </p>
                          <p className="text-[11px] text-brand-muted">
                            {fmtBytes(job.upload.byteSize)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-muted">—</span>
                      )}
                    </AdminTd>
                    <AdminTd>
                      <JobStatusBadge status={job.status} />
                      {job.errorMessage && (
                        <p className="mt-1 max-w-[160px] truncate text-[11px] text-red-400">
                          {job.errorMessage}
                        </p>
                      )}
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-brand-muted">
                        {job.attempts}/{job.maxAttempts}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-brand-muted">{fmtDate(job.startedAt)}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-brand-muted">{fmtDate(job.completedAt)}</span>
                    </AdminTd>
                    <AdminTd className="text-right">
                      {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                        <RetryButton jobId={job.id} />
                      )}
                    </AdminTd>
                  </tr>
                ))}
              </AdminTbody>
            )}
          </AdminTable>

          {(data?.totalPages ?? 0) > 1 && (
            <AdminPagination
              page={page}
              totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0}
              pageSize={25}
              onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
