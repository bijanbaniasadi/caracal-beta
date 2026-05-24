'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useCorpusClusters,
  useCorpusFiles,
  useEnqueueCorpusScan,
  useLatestCorpusRun,
  useOriModPairs,
  usePauseCorpus,
  useResetFailedCorpusJobs,
  useResumeCorpus,
  useUnknownFamilies,
} from '@/hooks/queries/use-admin-corpus';
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
import type { EcuCorpusFile, EcuFileCluster, EcuOriModPair, ListParams } from '@/lib/api/admin-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}

function fmtBytes(n: string | number) {
  const bytes = Number(n);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Run status badge ─────────────────────────────────────────────────────────

const RUN_STATUS_COLORS: Record<string, string> = {
  RUNNING:   'border-amber-400/40 bg-amber-400/10 text-amber-400',
  COMPLETED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400',
  FAILED:    'border-red-400/40 bg-red-400/10 text-red-400',
  PAUSED:    'border-sky-400/40 bg-sky-400/10 text-sky-400',
};

function RunStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        RUN_STATUS_COLORS[status] ?? 'border-white/20 bg-white/5 text-brand-muted',
      ].join(' ')}
    >
      {status}
    </span>
  );
}

// ─── Latest run card ──────────────────────────────────────────────────────────

function LatestRunCard() {
  const { data: run, isLoading } = useLatestCorpusRun(20_000);
  const pauseMut = usePauseCorpus();
  const resumeMut = useResumeCorpus();
  const resetMut = useResetFailedCorpusJobs();
  const { addToast } = useToastContext();

  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />;
  }
  if (!run) return null;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); addToast({ variant: 'success', title: msg }); }
    catch { addToast({ variant: 'error', title: 'Action failed' }); }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="font-display text-sm font-bold text-brand-text">Latest Run</p>
        <RunStatusBadge status={run.status} />
        <code className="font-mono text-[11px] text-brand-muted">{run.id.slice(0, 12)}…</code>
        <div className="ml-auto flex gap-2">
          {run.status === 'RUNNING' && (
            <button
              type="button"
              disabled={pauseMut.isPending}
              onClick={() => void act(() => pauseMut.mutateAsync(run.id), 'Corpus paused')}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted hover:border-amber-400/30 hover:text-amber-400 disabled:opacity-40"
            >
              ⏸ Pause
            </button>
          )}
          {run.status === 'PAUSED' && (
            <button
              type="button"
              disabled={resumeMut.isPending}
              onClick={() => void act(() => resumeMut.mutateAsync(run.id), 'Corpus resumed')}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted hover:border-emerald-400/30 hover:text-emerald-400 disabled:opacity-40"
            >
              ▶ Resume
            </button>
          )}
          <button
            type="button"
            disabled={resetMut.isPending}
            onClick={() => void act(() => resetMut.mutateAsync(run.id), 'Failed jobs reset')}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted hover:border-sky-400/30 hover:text-sky-400 disabled:opacity-40"
          >
            ↺ Reset Failed
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Files',     value: run.totalFiles ?? 0 },
          { label: 'Processed',       value: run.processedFiles ?? 0 },
          { label: 'Failed',          value: run.failedFiles ?? 0 },
          { label: 'Skipped',         value: run.skippedFiles ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="font-mono text-lg font-bold text-brand-text">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-brand-muted">
        <span>Started: {fmtDate(run.startedAt)}</span>
        {run.completedAt && <span>Completed: {fmtDate(run.completedAt)}</span>}
        {run.rootPath && <span>Root: <code className="text-brand-text">{run.rootPath}</code></span>}
      </div>
    </div>
  );
}

// ─── Scan enqueue form ────────────────────────────────────────────────────────

function ScanEnqueueForm() {
  const [rootPath, setRootPath] = useState('');
  const [maxFiles, setMaxFiles] = useState('');
  const { mutateAsync, isPending } = useEnqueueCorpusScan();
  const { addToast } = useToastContext();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPath.trim()) return;
    try {
      await mutateAsync({ rootPath: rootPath.trim(), maxFiles: maxFiles ? Number(maxFiles) : undefined });
      addToast({ variant: 'success', title: 'Corpus scan queued' });
      setRootPath('');
      setMaxFiles('');
    } catch {
      addToast({ variant: 'error', title: 'Enqueue failed' });
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={rootPath}
        onChange={(e) => setRootPath(e.target.value)}
        placeholder="/path/to/ecu/corpus"
        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
      />
      <input
        type="number"
        value={maxFiles}
        onChange={(e) => setMaxFiles(e.target.value)}
        placeholder="Max files (opt)"
        className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
      />
      <button
        type="submit"
        disabled={isPending || !rootPath.trim()}
        className="rounded-lg bg-brand-orange px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
      >
        {isPending ? '…' : '▶ Enqueue Scan'}
      </button>
    </form>
  );
}

// ─── Files tab ────────────────────────────────────────────────────────────────

function FilesTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [extension, setExtension] = useState('');

  const params: ListParams & { extension?: string } = {
    page, pageSize: 30,
    search: search || undefined,
    extension: extension || undefined,
  };

  const { data, isLoading } = useCorpusFiles(params);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search files…"
          className="w-56 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        <input
          type="text"
          value={extension}
          onChange={(e) => { setExtension(e.target.value); setPage(1); }}
          placeholder=".bin .hex …"
          className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        <p className="ml-auto self-center text-xs text-brand-muted">
          {isLoading ? '…' : `${data?.total ?? 0} files`}
        </p>
      </div>
      {isLoading ? <AdminTableSkeleton rows={8} cols={5} /> : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>File</AdminTh>
                <AdminTh>Kind</AdminTh>
                <AdminTh>Size</AdminTh>
                <AdminTh>Families</AdminTh>
                <AdminTh>Indexed</AdminTh>
                <AdminTh className="text-right">Actions</AdminTh>
              </tr>
            </AdminThead>
            {(data?.items.length ?? 0) === 0 ? (
              <AdminTableEmpty message="No files found" colSpan={6} />
            ) : (
              <AdminTbody>
                {data?.items.map((f: EcuCorpusFile) => (
                  <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <AdminTd>
                      <p className="max-w-[220px] truncate font-mono text-xs text-brand-text">
                        {f.fileName}
                      </p>
                      <p className="max-w-[220px] truncate text-[11px] text-brand-muted">
                        {f.relativePath}
                      </p>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-brand-muted">{f.detectedKind ?? '—'}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-brand-muted">
                        {fmtBytes(f.sizeBytes)}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <div className="flex flex-wrap gap-1">
                        {f.detectedFamilies.slice(0, 2).map((fam) => (
                          <span
                            key={fam.id}
                            className="rounded-full border border-sky-400/20 bg-sky-400/5 px-1.5 py-0.5 text-[10px] text-sky-400"
                          >
                            {fam.familyLabel ?? fam.familyKey} {pct(fam.confidence)}
                          </span>
                        ))}
                      </div>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-brand-muted">{fmtDate(f.indexedAt)}</span>
                    </AdminTd>
                    <AdminTd className="text-right">
                      <Link
                        href={`/admin/corpus/files/${f.id}`}
                        className="rounded border border-white/10 px-2 py-0.5 text-xs text-brand-muted hover:text-brand-text transition-colors"
                      >
                        Explore →
                      </Link>
                    </AdminTd>
                  </tr>
                ))}
              </AdminTbody>
            )}
          </AdminTable>
          {(data?.totalPages ?? 0) > 1 && (
            <AdminPagination
              page={page} totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0} pageSize={30} onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Clusters tab ─────────────────────────────────────────────────────────────

function ClustersTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCorpusClusters({ page, pageSize: 25, search: search || undefined });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search clusters…"
          className="w-56 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        <p className="ml-auto text-xs text-brand-muted">
          {isLoading ? '…' : `${data?.total ?? 0} clusters`}
        </p>
      </div>
      {isLoading ? <AdminTableSkeleton rows={6} cols={4} /> : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Cluster</AdminTh>
                <AdminTh>Family</AdminTh>
                <AdminTh>Members</AdminTh>
                <AdminTh>Confidence</AdminTh>
                <AdminTh>Signatures</AdminTh>
              </tr>
            </AdminThead>
            {(data?.items.length ?? 0) === 0 ? (
              <AdminTableEmpty message="No clusters found" colSpan={5} />
            ) : (
              <AdminTbody>
                {data?.items.map((c: EcuFileCluster) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <AdminTd>
                      <p className="font-medium text-brand-text">{c.label ?? c.clusterKey}</p>
                      <code className="text-[11px] text-brand-muted">{c.clusterType ?? ''}</code>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-sky-400">{c.familyKey ?? '—'}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-sm font-bold text-brand-text">
                        {c.memberCount}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-emerald-400">
                        {pct(c.confidence)}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-brand-muted">
                        {c.signatures.length}
                      </span>
                    </AdminTd>
                  </tr>
                ))}
              </AdminTbody>
            )}
          </AdminTable>
          {(data?.totalPages ?? 0) > 1 && (
            <AdminPagination
              page={page} totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0} pageSize={25} onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Unknown families tab ─────────────────────────────────────────────────────

function UnknownTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUnknownFamilies({ page, pageSize: 25 });

  return (
    <div className="space-y-3">
      <p className="text-xs text-brand-muted">
        {isLoading ? '…' : `${data?.total ?? 0} unknown families detected`}
      </p>
      {isLoading ? <AdminTableSkeleton rows={6} cols={3} /> : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Key</AdminTh>
                <AdminTh>Label</AdminTh>
                <AdminTh>Members</AdminTh>
                <AdminTh>Confidence</AdminTh>
              </tr>
            </AdminThead>
            {(data?.items.length ?? 0) === 0 ? (
              <AdminTableEmpty message="No unknown families" colSpan={4} />
            ) : (
              <AdminTbody>
                {data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <AdminTd>
                      <code className="font-mono text-xs text-violet-400">{u.unknownKey}</code>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-sm text-brand-text">{u.label ?? '—'}</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-sm font-bold text-brand-text">
                        {u.memberCount}
                      </span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-amber-400">{pct(u.confidence)}</span>
                    </AdminTd>
                  </tr>
                ))}
              </AdminTbody>
            )}
          </AdminTable>
          {(data?.totalPages ?? 0) > 1 && (
            <AdminPagination
              page={page} totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0} pageSize={25} onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── ORI/MOD pairs tab ────────────────────────────────────────────────────────

function OriModTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOriModPairs({ page, pageSize: 20 });

  return (
    <div className="space-y-3">
      <p className="text-xs text-brand-muted">
        {isLoading ? '…' : `${data?.total ?? 0} ORI/MOD pairs`}
      </p>
      {isLoading ? <AdminTableSkeleton rows={6} cols={5} /> : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <AdminTable>
            <AdminThead>
              <tr>
                <AdminTh>Original</AdminTh>
                <AdminTh>Modified</AdminTh>
                <AdminTh>Mod Type</AdminTh>
                <AdminTh>Confidence</AdminTh>
                <AdminTh className="text-right">Actions</AdminTh>
              </tr>
            </AdminThead>
            {(data?.items.length ?? 0) === 0 ? (
              <AdminTableEmpty message="No ORI/MOD pairs found" colSpan={5} />
            ) : (
              <AdminTbody>
                {data?.items.map((pair: EcuOriModPair) => (
                  <tr key={pair.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <AdminTd>
                      <p className="max-w-[180px] truncate font-mono text-xs text-brand-text">
                        {pair.originalFile.fileName}
                      </p>
                    </AdminTd>
                    <AdminTd>
                      <p className="max-w-[180px] truncate font-mono text-xs text-sky-400">
                        {pair.modifiedFile.fileName}
                      </p>
                    </AdminTd>
                    <AdminTd>
                      <span className="text-xs text-brand-muted">—</span>
                    </AdminTd>
                    <AdminTd>
                      <span className="font-mono text-xs text-emerald-400">
                        {pct(pair.confidence)}
                      </span>
                    </AdminTd>
                    <AdminTd className="text-right">
                      <Link
                        href={`/admin/corpus/ori-mod/${pair.id}`}
                        className="rounded border border-white/10 px-2 py-0.5 text-xs text-brand-muted hover:text-brand-text transition-colors"
                      >
                        Diff →
                      </Link>
                    </AdminTd>
                  </tr>
                ))}
              </AdminTbody>
            )}
          </AdminTable>
          {(data?.totalPages ?? 0) > 1 && (
            <AdminPagination
              page={page} totalPages={data?.totalPages ?? 1}
              total={data?.total ?? 0} pageSize={20} onPage={setPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'run' | 'files' | 'clusters' | 'unknown' | 'ori-mod';

const TABS: { value: Tab; label: string }[] = [
  { value: 'run',      label: 'Run Status' },
  { value: 'files',    label: 'Files' },
  { value: 'clusters', label: 'Clusters' },
  { value: 'unknown',  label: 'Unknown Families' },
  { value: 'ori-mod',  label: 'ORI/MOD Pairs' },
];

export default function CorpusPage() {
  const [activeTab, setActiveTab] = useState<Tab>('run');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-brand-text">ECU Corpus</h1>
          <p className="text-xs text-brand-muted">Corpus analysis pipeline &amp; file explorer</p>
        </div>
      </div>

      {/* Enqueue scan */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted">
          Enqueue New Scan
        </p>
        <ScanEnqueueForm />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === value
                ? 'border-b-2 border-brand-orange text-brand-orange'
                : 'text-brand-muted hover:text-brand-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'run'      && <LatestRunCard />}
      {activeTab === 'files'    && <FilesTab />}
      {activeTab === 'clusters' && <ClustersTab />}
      {activeTab === 'unknown'  && <UnknownTab />}
      {activeTab === 'ori-mod'  && <OriModTab />}
    </div>
  );
}
