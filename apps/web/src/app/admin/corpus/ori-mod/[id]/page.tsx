'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { useOriModPair } from '@/hooks/queries/use-admin-corpus';
import type { EcuModificationSignature, EcuOriModPairFull } from '@/lib/api/admin-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: string | number): string {
  const n = typeof b === 'string' ? parseInt(b, 10) : b;
  if (isNaN(n)) return '—';
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB`;
  if (n >= 1_024) return `${(n / 1_024).toFixed(1)} KB`;
  return `${n} B`;
}

function hexAddr(s: string | null | undefined): string {
  if (!s) return '—';
  const n = parseInt(s, 10);
  return isNaN(n) ? s : `0x${n.toString(16).toUpperCase().padStart(8, '0')}`;
}

function confBar(c: number) {
  const pct = Math.round(c * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-brand-muted">{pct}%</span>
    </div>
  );
}

// ─── Changed regions visualizer ───────────────────────────────────────────────

interface ChangedRegion {
  offset: number;
  length: number;
  type?: string;
  changedBytes?: number;
  percentChanged?: number;
}

const REGION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  map:       { bg: 'bg-brand-orange/15', text: 'text-brand-orange', border: 'border-brand-orange/30' },
  axis:      { bg: 'bg-sky-500/15',      text: 'text-sky-400',      border: 'border-sky-500/30' },
  scalar:    { bg: 'bg-violet-500/15',   text: 'text-violet-400',   border: 'border-violet-500/30' },
  checksum:  { bg: 'bg-red-500/15',      text: 'text-red-400',      border: 'border-red-500/30' },
  unknown:   { bg: 'bg-white/5',         text: 'text-brand-muted',  border: 'border-white/10' },
};

function ChangedRegionsPanel({ changedRegions, sizeBytes }: {
  changedRegions: unknown;
  sizeBytes: string;
}) {
  const regions = (Array.isArray(changedRegions) ? changedRegions : []) as ChangedRegion[];
  const totalBytes = parseInt(sizeBytes, 10) || 1;

  if (regions.length === 0) {
    return <p className="text-sm text-brand-muted">No changed regions detected.</p>;
  }

  // Sort by offset
  const sorted = [...regions].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));

  // Build linear annotation bands
  const TRACK_HEIGHT = 32;
  const TRACK_WIDTH = 100; // percentage

  return (
    <div className="space-y-4">
      {/* Visual track */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-white/5"
        style={{ height: TRACK_HEIGHT }}
      >
        {sorted.map((r, i) => {
          const left = (r.offset / totalBytes) * TRACK_WIDTH;
          const width = Math.max(0.3, (r.length / totalBytes) * TRACK_WIDTH);
          const type = (r.type ?? 'unknown').toLowerCase();
          const colors = REGION_COLORS[type] ?? REGION_COLORS.unknown;
          return (
            <div
              key={i}
              className={`absolute top-1 bottom-1 rounded ${colors.bg} ${colors.border} border`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${type} @ ${hexAddr(String(r.offset))} len ${fmtBytes(r.length)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(REGION_COLORS).map(([t, c]) => (
          <span key={t} className={`flex items-center gap-1.5 text-xs capitalize ${c.text}`}>
            <span className={`h-2 w-2 rounded-sm ${c.bg} border ${c.border}`} />
            {t}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="grid grid-cols-5 gap-4 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-brand-muted">
          <span>Type</span>
          <span>Offset</span>
          <span>Length</span>
          <span>Changed Bytes</span>
          <span>% Changed</span>
        </div>
        {sorted.map((r, i) => {
          const type = (r.type ?? 'unknown').toLowerCase();
          const colors = REGION_COLORS[type] ?? REGION_COLORS.unknown;
          return (
            <div
              key={i}
              className="grid grid-cols-5 gap-4 px-4 py-2.5 text-sm"
            >
              <span className={`font-medium capitalize ${colors.text}`}>{type}</span>
              <span className="font-mono text-brand-muted">{hexAddr(String(r.offset))}</span>
              <span className="text-brand-muted">{fmtBytes(r.length)}</span>
              <span className="text-brand-muted">{r.changedBytes ?? '—'}</span>
              <span className="text-brand-muted">
                {r.percentChanged != null ? `${r.percentChanged.toFixed(1)}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modification signatures ──────────────────────────────────────────────────

const SIG_TYPE_COLORS: Record<string, string> = {
  MAP_CHANGE:       'amber',
  AXIS_SHIFT:       'sky',
  SCALAR_ADJUST:    'violet',
  CHECKSUM_UPDATE:  'red',
  METADATA_CHANGE:  'gray',
};

function ModSignaturesPanel({ signatures }: { signatures: EcuModificationSignature[] }) {
  if (signatures.length === 0) {
    return <p className="text-sm text-brand-muted">No modification signatures extracted.</p>;
  }

  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
      {signatures.map((s) => (
        <div key={s.id} className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AdminBadge
                variant={(SIG_TYPE_COLORS[s.signatureType] ?? 'gray') as Parameters<typeof AdminBadge>[0]['variant']}
              >
                {s.signatureType.replace(/_/g, ' ')}
              </AdminBadge>
              <span className="font-mono text-sm text-brand-text">{s.signatureKey}</span>
            </div>
            {confBar(s.confidence)}
          </div>
          {s.regions != null && (
            <pre className="mt-2 rounded bg-white/5 p-2 font-mono text-xs text-brand-muted overflow-x-auto">
              {JSON.stringify(s.regions, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── File comparison card ─────────────────────────────────────────────────────

function FileCard({
  label,
  file,
}: {
  label: string;
  file: EcuOriModPairFull['originalFile'];
}) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p>
      <p className="font-mono text-sm font-medium text-brand-text">{file.fileName}</p>
      <p className="mt-0.5 text-xs text-brand-muted">{file.relativePath}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {file.detectedKind && <AdminBadge variant="sky">{file.detectedKind}</AdminBadge>}
        <span className="text-xs text-brand-muted">{fmtBytes(file.sizeBytes)}</span>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-brand-muted/60">{file.sha256}</p>
      <Link
        href={`/admin/corpus/files/${file.id}`}
        className="mt-3 inline-block rounded border border-white/10 px-3 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-text transition-colors"
      >
        Open in Explorer →
      </Link>
    </div>
  );
}

// ─── Changed map candidates ───────────────────────────────────────────────────

interface ChangedMapCandidate {
  name?: string;
  address?: string | number;
  confidence?: number;
  type?: string;
}

function ChangedMapCandidatesPanel({ data }: { data: unknown }) {
  const candidates = (Array.isArray(data) ? data : []) as ChangedMapCandidate[];

  if (candidates.length === 0) {
    return <p className="text-sm text-brand-muted">No changed map candidates identified.</p>;
  }

  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
      {candidates.map((c, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2.5">
          <div>
            <span className="font-mono text-sm text-brand-text">{c.name ?? 'unknown'}</span>
            <span className="ml-3 font-mono text-xs text-brand-muted">{hexAddr(String(c.address ?? ''))}</span>
            {c.type && <span className="ml-2 text-xs text-brand-muted">· {c.type}</span>}
          </div>
          {c.confidence != null && confBar(c.confidence)}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OriModPairPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: pair, isLoading, error } = useOriModPair(id);

  if (isLoading) return (
    <div className="p-8">
      <AdminTableSkeleton rows={4} cols={3} />
    </div>
  );

  if (error || !pair) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-brand-muted">ORI/MOD pair not found.</p>
    </div>
  );

  const pct = Math.round(pair.confidence * 100);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/corpus" className="text-xs text-brand-muted hover:text-brand-text">
            ← Corpus
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-text">
            ORI / MOD Diff
          </h1>
          <p className="mt-1 font-mono text-xs text-brand-muted">{pair.id}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {pair.probableModificationType && (
            <AdminBadge variant="amber">{pair.probableModificationType}</AdminBadge>
          )}
          <div className="text-right">
            <p className="text-xs text-brand-muted">Confidence</p>
            <p className="text-lg font-bold text-brand-text">{pct}%</p>
          </div>
        </div>
      </div>

      {/* Pair metadata strip */}
      <div className="grid grid-cols-3 gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <div>
          <p className="text-xs text-brand-muted">File Size</p>
          <p className="text-sm font-medium text-brand-text">{fmtBytes(pair.sizeBytes)}</p>
        </div>
        <div>
          <p className="text-xs text-brand-muted">SHA Distance</p>
          <p className="text-sm font-medium text-brand-text">
            {pair.shaDistance != null ? pair.shaDistance.toFixed(4) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-brand-muted">Modification Signatures</p>
          <p className="text-sm font-medium text-brand-text">
            {pair.modificationSignatures.length}
          </p>
        </div>
      </div>

      {/* File pair */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
          File Pair
        </h2>
        <div className="flex gap-4">
          <FileCard label="Original (ORI)" file={pair.originalFile} />
          <div className="flex flex-col items-center justify-center px-2">
            <div className="text-2xl text-brand-muted">→</div>
            <div className="mt-1 text-xs text-brand-muted">diff</div>
          </div>
          <FileCard label="Modified (MOD)" file={pair.modifiedFile} />
        </div>
      </section>

      {/* Changed regions */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Changed Regions
        </h2>
        <ChangedRegionsPanel
          changedRegions={pair.changedRegions}
          sizeBytes={pair.sizeBytes}
        />
      </section>

      {/* Changed map candidates */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Changed Map Candidates
        </h2>
        <ChangedMapCandidatesPanel data={pair.changedMapCandidates} />
      </section>

      {/* Modification signatures */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Modification Signatures ({pair.modificationSignatures.length})
        </h2>
        <ModSignaturesPanel signatures={pair.modificationSignatures} />
      </section>
    </div>
  );
}
