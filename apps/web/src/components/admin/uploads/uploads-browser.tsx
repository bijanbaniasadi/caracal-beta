'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BinUploadRecord } from '@/lib/api/admin-types';
import type { BinUploadStatus } from '@/lib/api/types';
import {
  AdminTable, AdminThead, AdminTh, AdminTbody, AdminTr, AdminTd,
  AdminTableEmpty, AdminPagination,
} from '@/components/admin/ui/admin-table';
import { BinUploadStatusBadge, AdminBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';

interface UploadsBrowserProps {
  items: BinUploadRecord[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Metadata drawer ──────────────────────────────────────────────────────────

function UploadDrawer({
  upload,
  onClose,
}: {
  upload: BinUploadRecord;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative z-50 flex h-full w-96 flex-col overflow-y-auto border-l border-white/10 bg-[#0f1923] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-brand-text">
            Upload Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-muted hover:text-brand-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 text-sm">
          <Row label="File name" value={upload.originalFileName} mono />
          <Row label="Size" value={formatBytes(upload.byteSize)} />
          <Row label="Status">
            <BinUploadStatusBadge status={upload.status} />
          </Row>
          <Row label="Storage" value={upload.storageProvider} />
          <Row label="Object key" value={upload.storedObjectKey} mono />
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-muted">
              SHA-256
            </p>
            <code className="block break-all rounded bg-white/5 px-3 py-2 font-mono text-xs text-brand-text">
              {upload.sha256}
            </code>
          </div>
          {upload.requesterName && (
            <Row label="Requester" value={upload.requesterName} />
          )}
          {upload.requesterEmail && (
            <Row label="Email" value={upload.requesterEmail} />
          )}
          {upload.productContext && (
            <Row label="Product context" value={upload.productContext} />
          )}
          {upload.notes && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-muted">
                Notes
              </p>
              <p className="text-sm text-brand-text">{upload.notes}</p>
            </div>
          )}
          {upload.quoteRequestId && (
            <Row label="Quote request ID" value={upload.quoteRequestId} mono />
          )}
          <Row label="Uploaded" value={formatDate(upload.createdAt)} />
        </div>
      </aside>
    </div>
  );
}

function Row({
  label, value, mono, children,
}: { label: string; value?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-brand-muted">
        {label}
      </p>
      {children ?? (
        <p className={['text-sm text-brand-text', mono ? 'font-mono break-all' : ''].join(' ')}>
          {value ?? '—'}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: BinUploadStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'VALIDATED', label: 'Validated' },
  { value: 'STORED', label: 'Stored' },
  { value: 'REJECTED', label: 'Rejected' },
];

interface UploadsBrowserWithFilterProps extends UploadsBrowserProps {
  statusFilter: BinUploadStatus | '';
  onStatusFilter: (s: BinUploadStatus | '') => void;
}

export function UploadsBrowser({
  items, isLoading, total, page, pageSize, totalPages, onPage,
  statusFilter, onStatusFilter,
}: UploadsBrowserWithFilterProps) {
  const [selected, setSelected] = useState<BinUploadRecord | null>(null);

  if (isLoading) return <AdminTableSkeleton rows={8} cols={6} />;

  return (
    <>
      {selected && (
        <UploadDrawer upload={selected} onClose={() => setSelected(null)} />
      )}

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onStatusFilter(value as BinUploadStatus | '')}
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

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>File</AdminTh>
              <AdminTh>Size</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Storage</AdminTh>
              <AdminTh>Requester</AdminTh>
              <AdminTh>Uploaded</AdminTh>
              <AdminTh className="text-right">Actions</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No uploads found" colSpan={7} />
          ) : (
            <AdminTbody>
              {items.map((upload) => (
                <AdminTr
                  key={upload.id}
                  onClick={() => setSelected(upload)}
                >
                  <AdminTd>
                    <code className="font-mono text-xs text-brand-text">
                      {upload.originalFileName}
                    </code>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-brand-muted">
                      {formatBytes(upload.byteSize)}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    <BinUploadStatusBadge status={upload.status} />
                  </AdminTd>
                  <AdminTd>
                    <AdminBadge variant="gray">{upload.storageProvider}</AdminBadge>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-brand-muted">
                      {upload.requesterEmail ?? upload.requesterName ?? '—'}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-brand-muted">
                      {formatDate(upload.createdAt)}
                    </span>
                  </AdminTd>
                  <AdminTd className="text-right">
                    <Link
                      href={`/admin/uploads/${upload.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border border-white/10 px-2 py-0.5 text-xs text-brand-muted hover:text-brand-text transition-colors"
                    >
                      Details →
                    </Link>
                  </AdminTd>
                </AdminTr>
              ))}
            </AdminTbody>
          )}
        </AdminTable>

        {totalPages > 1 && (
          <AdminPagination
            page={page} totalPages={totalPages}
            total={total} pageSize={pageSize} onPage={onPage}
          />
        )}
      </div>
    </>
  );
}
