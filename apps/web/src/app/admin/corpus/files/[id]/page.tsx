'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AdminBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { useCorpusFile } from '@/hooks/queries/use-admin-corpus';
import type {
  EcuChecksumCandidate,
  EcuClusterMembership,
  EcuCorpusFileFull,
  EcuDtcCandidate,
  EcuMapDefinitionFull,
  EcuProjectLabel,
} from '@/lib/api/admin-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: string | number): string {
  const n = typeof b === 'string' ? parseInt(b, 10) : b;
  if (isNaN(n)) return '—';
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(2)} MB`;
  if (n >= 1_024) return `${(n / 1_024).toFixed(1)} KB`;
  return `${n} B`;
}

function hexAddr(s: string | null): string {
  if (!s) return '—';
  const n = parseInt(s, 10);
  return isNaN(n) ? s : `0x${n.toString(16).toUpperCase().padStart(8, '0')}`;
}

function confBar(c: number) {
  const pct = Math.round(c * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-brand-muted">{pct}%</span>
    </div>
  );
}

// ─── Calibration entropy heatmap ──────────────────────────────────────────────

interface CalibRegion {
  offset: number;
  length: number;
  type?: string;
  confidence?: number;
}

function EntropyHeatmap({
  calibrationRegions,
  totalBytes,
}: {
  calibrationRegions: unknown;
  totalBytes: number;
}) {
  const regions = (Array.isArray(calibrationRegions) ? calibrationRegions : []) as CalibRegion[];

  if (regions.length === 0) {
    return (
      <p className="text-sm text-brand-muted">No calibration regions extracted.</p>
    );
  }

  const CELLS = 256;
  const cellBytes = Math.ceil(totalBytes / CELLS);

  // Build coverage per cell
  const coverage: number[] = new Array(CELLS).fill(0);
  for (const r of regions) {
    const startCell = Math.floor(r.offset / cellBytes);
    const endCell = Math.min(CELLS - 1, Math.floor((r.offset + r.length) / cellBytes));
    const conf = r.confidence ?? 1;
    for (let c = startCell; c <= endCell; c++) {
      coverage[c] = Math.max(coverage[c], conf);
    }
  }

  const typeColors: Record<string, string> = {
    map: 'bg-brand-orange',
    axis: 'bg-sky-500',
    scalar: 'bg-violet-500',
    string: 'bg-green-500',
    checksum: 'bg-red-500',
    unknown: 'bg-white/20',
  };

  // Build a quick lookup: cell → region type
  const cellType: string[] = new Array(CELLS).fill('');
  for (const r of regions) {
    const startCell = Math.floor(r.offset / cellBytes);
    const endCell = Math.min(CELLS - 1, Math.floor((r.offset + r.length) / cellBytes));
    const t = (r.type ?? 'unknown').toLowerCase();
    for (let c = startCell; c <= endCell; c++) {
      if (!cellType[c]) cellType[c] = t;
    }
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(typeColors).map(([t, cls]) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-brand-muted capitalize">
            <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
            {t}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div
        className="grid gap-px rounded-lg overflow-hidden"
        style={{ gridTemplateColumns: `repeat(32, minmax(0, 1fr))` }}
        title={`${regions.length} calibration regions · ${fmtBytes(totalBytes)}`}
      >
        {coverage.map((c, i) => {
          const t = cellType[i] ?? 'unknown';
          const colorCls = c > 0
            ? (typeColors[t] ?? 'bg-white/20')
            : 'bg-white/5';
          const alpha = c > 0 ? Math.max(0.25, c) : 1;
          return (
            <div
              key={i}
              className={`h-4 ${colorCls}`}
              style={{ opacity: alpha }}
              title={`Cell ${i} · ${hexAddr(String(i * cellBytes))} · ${t} · ${Math.round(c * 100)}%`}
            />
          );
        })}
      </div>

      <p className="text-xs text-brand-muted">
        {regions.length} region{regions.length !== 1 ? 's' : ''} ·{' '}
        {CELLS} cells · {fmtBytes(cellBytes)}/cell · file size {fmtBytes(totalBytes)}
      </p>
    </div>
  );
}

// ─── Tab panel helpers ────────────────────────────────────────────────────────

type Tab = 'fingerprint' | 'maps' | 'labels' | 'checksums' | 'dtc' | 'clusters';
const TABS: { id: Tab; label: string }[] = [
  { id: 'fingerprint', label: 'Fingerprint' },
  { id: 'maps', label: 'Map Defs' },
  { id: 'labels', label: 'Labels' },
  { id: 'checksums', label: 'Checksums' },
  { id: 'dtc', label: 'DTC' },
  { id: 'clusters', label: 'Clusters' },
];

// ─── Fingerprint panel ────────────────────────────────────────────────────────

function FingerprintPanel({ file }: { file: EcuCorpusFileFull }) {
  const fp = file.fingerprint;

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Identity
        </h3>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            { label: 'Architecture', value: fp?.architecture },
            { label: 'Supplier', value: fp?.supplier },
            { label: 'Probable OEM', value: fp?.probableOem },
            { label: 'Controller Type', value: fp?.controllerType },
            { label: 'Fuel Type', value: fp?.fuelType },
            { label: 'SW Version', value: fp?.softwareVersion },
            { label: 'HW Number', value: fp?.hardwareNumber },
            { label: 'Entropy', value: fp?.entropy != null ? fp.entropy.toFixed(4) : null },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-brand-muted">{label}</dt>
              <dd className="mt-0.5 text-sm text-brand-text">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Detected families */}
      {file.detectedFamilies.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
            Detected Families
          </h3>
          <div className="space-y-1.5">
            {file.detectedFamilies.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2"
              >
                <div>
                  <span className="text-sm font-medium text-brand-text">{f.familyLabel ?? f.familyKey}</span>
                  {f.oem && <span className="ml-2 text-xs text-brand-muted">{f.oem}</span>}
                </div>
                {confBar(f.confidence)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intelligence summary */}
      {fp?.intelligenceSummary != null && (
        <div>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
            Intelligence Summary
          </h3>
          <pre className="rounded-lg border border-white/10 bg-white/[0.02] p-4 font-mono text-xs text-brand-muted overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(fp.intelligenceSummary, null, 2)}
          </pre>
        </div>
      )}

      {/* Calibration heatmap */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
          Calibration Region Map
        </h3>
        <EntropyHeatmap
          calibrationRegions={fp?.calibrationRegions}
          totalBytes={parseInt(file.sizeBytes, 10) || 0}
        />
      </div>
    </div>
  );
}

// ─── Map definitions panel ────────────────────────────────────────────────────

function MapDefsPanel({ maps }: { maps: EcuMapDefinitionFull[] }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'address' | 'confidence' | 'name'>('address');

  const filtered = maps
    .filter((m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.dataType ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'address') {
        const av = parseInt(a.address ?? '0', 10);
        const bv = parseInt(b.address ?? '0', 10);
        return av - bv;
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
          placeholder="Search maps…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2 text-sm text-brand-text outline-none"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="address">Sort: Address</option>
          <option value="name">Sort: Name</option>
        </select>
        <span className="shrink-0 text-xs text-brand-muted">
          {filtered.length} / {maps.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-brand-muted">No map definitions.</p>
      ) : (
        <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
          {filtered.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-sm font-medium text-brand-text">{m.name}</span>
                  <span className="ml-3 font-mono text-xs text-brand-muted">{hexAddr(m.address)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.dataType && <AdminBadge variant="sky">{m.dataType}</AdminBadge>}
                  {m.unit && <AdminBadge variant="violet">{m.unit}</AdminBadge>}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-brand-muted">
                {m.factor != null && <span>× {m.factor}</span>}
                {m.offset != null && <span>+ {m.offset}</span>}
                {m.regions.length > 0 && (
                  <span>{m.regions.length} region{m.regions.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              {m.comments && (
                <p className="mt-1 text-xs text-brand-muted">{m.comments}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Project labels panel ─────────────────────────────────────────────────────

const LABEL_TYPE_COLORS: Record<string, string> = {
  MAP:      'amber',
  AXIS:     'sky',
  SCALAR:   'violet',
  STRING:   'green',
  FUNCTION: 'orange',
};

function LabelsPanel({ labels }: { labels: EcuProjectLabel[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const types = [...new Set(labels.map((l) => l.labelType))].sort();

  const filtered = labels.filter((l) => {
    const matchSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.unit ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || l.labelType === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
          placeholder="Search labels…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2 text-sm text-brand-text outline-none"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="shrink-0 text-xs text-brand-muted">
          {filtered.length} / {labels.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-brand-muted">No labels found.</p>
      ) : (
        <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
          {filtered.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AdminBadge
                    variant={(LABEL_TYPE_COLORS[l.labelType] ?? 'gray') as Parameters<typeof AdminBadge>[0]['variant']}
                  >
                    {l.labelType}
                  </AdminBadge>
                  <span className="font-mono text-sm text-brand-text truncate max-w-[300px]">
                    {l.name}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-brand-muted">
                  <span>{hexAddr(l.address)}</span>
                  {l.dataType && <span>{l.dataType}</span>}
                  {l.unit && <span>{l.unit}</span>}
                  {l.factor != null && <span>× {l.factor}</span>}
                  {l.source && <span>src: {l.source}</span>}
                </div>
              </div>
              {confBar(l.confidence)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Checksum candidates panel ────────────────────────────────────────────────

function ChecksumsPanel({ candidates }: { candidates: EcuChecksumCandidate[] }) {
  if (candidates.length === 0) {
    return <p className="text-sm text-brand-muted">No checksum candidates.</p>;
  }
  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
      {candidates.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div>
            <span className="font-mono text-sm text-brand-text">{c.family}</span>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-brand-muted">
              <span>offset {hexAddr(c.offset)}</span>
              {c.length != null && <span>len {c.length}</span>}
            </div>
          </div>
          {confBar(c.confidence)}
        </div>
      ))}
    </div>
  );
}

// ─── DTC candidates panel ─────────────────────────────────────────────────────

function DtcPanel({ candidates }: { candidates: EcuDtcCandidate[] }) {
  if (candidates.length === 0) {
    return <p className="text-sm text-brand-muted">No DTC candidates.</p>;
  }
  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
      {candidates.map((d) => (
        <div key={d.id} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AdminBadge variant="sky">{d.encoding}</AdminBadge>
            </div>
            {confBar(d.confidence)}
          </div>
          {d.sampleCodes != null && (
            <pre className="mt-2 rounded bg-white/5 p-2 font-mono text-xs text-brand-muted overflow-x-auto">
              {JSON.stringify(d.sampleCodes, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Cluster memberships panel ────────────────────────────────────────────────

function ClustersPanel({ memberships }: { memberships: EcuClusterMembership[] }) {
  if (memberships.length === 0) {
    return <p className="text-sm text-brand-muted">Not a member of any cluster.</p>;
  }
  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden">
      {memberships.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-brand-text">
              {m.cluster.label ?? m.cluster.clusterKey}
            </p>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-brand-muted">
              {m.cluster.familyKey && <span>{m.cluster.familyKey}</span>}
              {m.cluster.clusterType && <AdminBadge variant="gray">{m.cluster.clusterType}</AdminBadge>}
            </div>
          </div>
          <div className="text-right shrink-0">
            {confBar(m.score)}
            <span className="mt-0.5 block text-xs text-brand-muted">
              cluster conf {Math.round(m.cluster.confidence * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CorpusFileDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>('fingerprint');

  const { data: file, isLoading, error } = useCorpusFile(id);

  if (isLoading) return (
    <div className="p-8">
      <AdminTableSkeleton rows={5} cols={3} />
    </div>
  );

  if (error || !file) return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-brand-muted">File not found.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/corpus" className="text-xs text-brand-muted hover:text-brand-text">
            ← Corpus
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-text">
            {file.fileName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-brand-muted">{file.relativePath}</span>
            <AdminBadge variant="gray">{file.extension}</AdminBadge>
            {file.detectedKind && <AdminBadge variant="sky">{file.detectedKind}</AdminBadge>}
            <span className="text-xs text-brand-muted">{fmtBytes(file.sizeBytes)}</span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-brand-muted/60">{file.sha256}</p>
        </div>
        <div className="shrink-0 text-right text-xs text-brand-muted space-y-1">
          <p>{file._count.mapDefinitions} maps</p>
          <p>{file._count.projectLabels} labels</p>
          <p>{file._count.clusterMemberships} clusters</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
              tab === t.id
                ? 'bg-brand-orange text-white'
                : 'text-brand-muted hover:text-brand-text',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        {tab === 'fingerprint' && <FingerprintPanel file={file} />}
        {tab === 'maps' && <MapDefsPanel maps={file.mapDefinitions} />}
        {tab === 'labels' && <LabelsPanel labels={file.projectLabels} />}
        {tab === 'checksums' && <ChecksumsPanel candidates={file.checksumCandidates} />}
        {tab === 'dtc' && <DtcPanel candidates={file.dtcCandidates} />}
        {tab === 'clusters' && <ClustersPanel memberships={file.clusterMemberships} />}
      </div>

      {/* ORI/MOD pairs link */}
      <div className="flex items-center justify-end">
        <Link
          href={`/admin/corpus`}
          className="text-xs text-brand-muted hover:text-brand-text"
        >
          ← Back to Corpus Explorer
        </Link>
      </div>
    </div>
  );
}
