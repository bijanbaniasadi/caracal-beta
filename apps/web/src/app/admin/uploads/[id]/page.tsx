'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminBadge, BinUploadStatusBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { useAdminUpload, useUpdateBinUpload } from '@/hooks/queries/use-admin-uploads';
import { useAdminBinJobs, useEnqueueBinJob } from '@/hooks/queries/use-admin-bin-jobs';
import { useCorpusMatch } from '@/hooks/queries/use-admin-corpus';
import { useToastContext } from '@/lib/toast/context';
import type { BinUploadStatus, BinAnalysisJobStatus, EcuCorpusFile } from '@/lib/api/admin-types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(2)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} KB`;
  return `${b} B`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const JOB_STATUS_COLORS: Record<BinAnalysisJobStatus, string> = {
  PENDING:   'text-brand-muted',
  QUEUED:    'text-sky-400',
  RUNNING:   'text-brand-orange animate-pulse',
  COMPLETED: 'text-green-400',
  FAILED:    'text-red-400',
  CANCELLED: 'text-brand-muted',
};

const JOB_STATUS_DOT: Record<BinAnalysisJobStatus, string> = {
  PENDING:   'bg-brand-muted',
  QUEUED:    'bg-sky-400',
  RUNNING:   'bg-brand-orange',
  COMPLETED: 'bg-green-400',
  FAILED:    'bg-red-400',
  CANCELLED: 'bg-brand-muted',
};

function JobStatusBadge({ status }: { status: BinAnalysisJobStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${JOB_STATUS_COLORS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${JOB_STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}

// ─── Corpus match card ────────────────────────────────────────────────────────

function CorpusMatchPanel({ uploadId }: { uploadId: string }) {
  const [enabled, setEnabled] = useState(false);
  const { data, isLoading } = useCorpusMatch(uploadId, enabled);

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-4 py-2.5 text-sm font-medium text-brand-orange transition-colors hover:bg-brand-orange/15"
      >
        Run Corpus Match
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const total = data.exactMatches.length + data.sameSizeMatches.length;

  return (
    <div className="space-y-4">
      {/* Recommendation */}
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-300">
        <span className="font-semibold text-sky-200">Recommendation:</span>{' '}
        {data.recommendedNextManualReviewStep}
      </div>

      {total === 0 ? (
        <p className="text-sm text-brand-muted">No corpus matches found.</p>
      ) : (
        <>
          {data.exactMatches.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-muted">
                Exact SHA256 Matches ({data.exactMatches.length})
              </h4>
              <CorpusMatchList files={data.exactMatches} exact />
            </div>
          )}
          {data.sameSizeMatches.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-muted">
                Same-Size Candidates ({data.sameSizeMatches.length})
              </h4>
              <CorpusMatchList files={data.sameSizeMatches} exact={false} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CorpusMatchList({ files, exact }: { files: EcuCorpusFile[]; exact: boolean }) {
  return (
    <div className="divide-y divide-white/5 rounded-lg border border-white/10 overflow-hidden">
      {files.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm text-brand-text">{f.fileName}</p>
            <p className="font-mono text-xs text-brand-muted">{f.relativePath}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {exact && <AdminBadge variant="green">Exact</AdminBadge>}
            {f.fingerprint?.probableOem && (
              <AdminBadge variant="sky">{f.fingerprint.probableOem}</AdminBadge>
            )}
            <Link
              href={`/admin/corpus/files/${f.id}`}
              className="rounded border border-white/10 px-2 py-0.5 text-xs text-brand-muted hover:text-brand-text"
            >
              Open →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Status editor ────────────────────────────────────────────────────────────

const UPLOAD_STATUSES: BinUploadStatus[] = ['RECEIVED', 'VALIDATED', 'STORED', 'REJECTED'];

function StatusEditor({ id, current }: { id: string; current: BinUploadStatus }) {
  const [status, setStatus] = useState<BinUploadStatus>(current);
  const [rejectionReason, setRejectionReason] = useState('');
  const { mutateAsync, isPending } = useUpdateBinUpload(id);
  const { addToast } = useToastContext();

  const save = async () => {
    try {
      await mutateAsync({ status, rejectionReason: rejectionReason || undefined });
      addToast({ variant: 'success', title: 'Upload updated' });
    } catch {
      addToast({ variant: 'error', title: 'Update failed' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select
          className="rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-orange/50"
          value={status}
          onChange={(e) => setStatus(e.target.value as BinUploadStatus)}
        >
          {UPLOAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || status === current}
          onClick={() => { void save(); }}
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {status === 'REJECTED' && (
        <input
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
          placeholder="Rejection reason…"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  // Poll upload every 8s while jobs might be running
  const { data: upload, isLoading, error } = useAdminUpload(id, 8_000);
  const { data: jobsPage } = useAdminBinJobs({ status: undefined }, 8_000);
  const { mutateAsync: enqueue, isPending: isEnqueuing } = useEnqueueBinJob();
  const { addToast } = useToastContext();

  const jobs = upload?.analysisJobs ?? [];

  const handleEnqueue = async () => {
    try {
      await enqueue({ uploadId: id });
      addToast({ variant: 'success', title: 'Analysis job queued' });
    } catch {
      addToast({ variant: 'error', title: 'Failed to enqueue' });
    }
  };

  // Suppress unused variable warning — jobsPage shows global queue context elsewhere
  void jobsPage;

  if (isLoading) return (
    <div className="p-8">
      <AdminTableSkeleton rows={4} cols={3} />
    </div>
  );

  if (error || !upload) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-brand-muted">Upload not found.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/uploads" className="text-xs text-brand-muted hover:text-brand-text">
            ← Uploads
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-text">
            {upload.originalFileName}
          </h1>
          <p className="mt-1 font-mono text-xs text-brand-muted">{upload.sha256}</p>
        </div>
        <BinUploadStatusBadge status={upload.status} />
      </div>

      {/* Metadata grid */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
          File Metadata
        </h2>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Size', value: fmtBytes(upload.byteSize) },
            { label: 'Storage', value: upload.storageProvider },
            { label: 'Submitted', value: fmtDate(upload.createdAt) },
            { label: 'Updated', value: fmtDate(upload.updatedAt) },
            { label: 'Requester', value: upload.requesterName ?? '—' },
            { label: 'Email', value: upload.requesterEmail ?? '—' },
            { label: 'Product Context', value: upload.productContext ?? '—' },
            { label: 'Object Key', value: upload.storedObjectKey },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-brand-muted">{label}</dt>
              <dd className="mt-0.5 truncate text-sm text-brand-text">{value}</dd>
            </div>
          ))}
        </dl>
        {upload.notes && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Notes</p>
            <p className="mt-1 text-sm text-brand-text">{upload.notes}</p>
          </div>
        )}
        {upload.rejectionReason && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">Rejection Reason</p>
            <p className="mt-1 text-sm text-red-300">{upload.rejectionReason}</p>
          </div>
        )}
      </section>

      {/* Quote request link */}
      {upload.quoteRequest && (
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
            Quote Request
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm text-brand-text">{upload.quoteRequest.referenceCode}</p>
              <p className="text-sm text-brand-muted">
                {upload.quoteRequest.customerName} · {upload.quoteRequest.customerEmail}
              </p>
            </div>
            <Link
              href={`/admin/inquiries`}
              className="rounded border border-white/10 px-3 py-1.5 text-xs text-brand-muted hover:text-brand-text"
            >
              View Inquiry →
            </Link>
          </div>
        </section>
      )}

      {/* Status update */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Update Status
        </h2>
        <StatusEditor id={id} current={upload.status} />
      </section>

      {/* Analysis jobs */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            Analysis Jobs ({jobs.length})
          </h2>
          <button
            type="button"
            disabled={isEnqueuing}
            onClick={() => { void handleEnqueue(); }}
            className="rounded-lg border border-brand-orange/30 bg-brand-orange/5 px-3 py-1.5 text-xs font-medium text-brand-orange hover:bg-brand-orange/15 disabled:opacity-40 transition-colors"
          >
            {isEnqueuing ? 'Queuing…' : '+ Enqueue New Job'}
          </button>
        </div>

        {jobs.length === 0 ? (
          <p className="text-sm text-brand-muted">No analysis jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <JobStatusBadge status={job.status} />
                    <span className="font-mono text-xs text-brand-muted">
                      {job.id.slice(0, 12)}…
                    </span>
                    <span className="text-xs text-brand-muted">
                      attempt {job.attempts}/{job.maxAttempts}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-xs text-brand-muted">
                    <p>Started: {fmtDate(job.startedAt)}</p>
                    <p>Completed: {fmtDate(job.completedAt)}</p>
                  </div>
                </div>

                {job.errorMessage && (
                  <p className="mt-2 rounded bg-red-500/10 px-3 py-1.5 font-mono text-xs text-red-400">
                    {job.errorMessage}
                  </p>
                )}

                {job.results && job.results.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {job.results.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded bg-white/5 px-3 py-1.5 text-xs"
                      >
                        <span className="text-brand-muted">{r.resultType}</span>
                        <span className="text-brand-text">
                          {Math.round(r.confidence * 100)}% confidence
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Corpus match */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Corpus Match
        </h2>
        <CorpusMatchPanel uploadId={id} />
      </section>
    </div>
  );
}
