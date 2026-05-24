'use client';

import { useState } from 'react';
import type { IntakeRow } from '@/lib/api/admin-types';
import type { IntakeStatus } from '@/lib/api/types';
import {
  AdminTable, AdminThead, AdminTh, AdminTbody, AdminTr, AdminTd,
  AdminTableEmpty, AdminPagination,
} from '@/components/admin/ui/admin-table';
import { IntakeStatusBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { useToastContext } from '@/lib/toast/context';
import { updateIntakeStatus } from '@/lib/api/admin-client';
import { useQueryClient } from '@tanstack/react-query';
import { adminIntakeKey } from '@/hooks/queries/use-admin-intake';

// ─── Type label ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<IntakeRow['type'], string> = {
  quote_request:       'Quote Request',
  product_inquiry:     'Product Inquiry',
  workshop_consultation: 'Workshop Lead',
};

const TYPE_COLORS: Record<IntakeRow['type'], string> = {
  quote_request:         'text-brand-orange',
  product_inquiry:       'text-sky-400',
  workshop_consultation: 'text-violet-400',
};

// ─── Status action menu ───────────────────────────────────────────────────────

const STATUS_OPTIONS: IntakeStatus[] = [
  'NEW', 'IN_REVIEW', 'RESPONDED', 'CLOSED', 'SPAM',
];

const INTAKE_TYPE_SLUG: Record<IntakeRow['type'], 'quote-requests' | 'product-inquiries' | 'workshop-leads'> = {
  quote_request:         'quote-requests',
  product_inquiry:       'product-inquiries',
  workshop_consultation: 'workshop-leads',
};

function StatusMenu({ row }: { row: IntakeRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastContext();
  const qc = useQueryClient();

  const handle = async (status: IntakeStatus) => {
    setOpen(false);
    setBusy(true);
    try {
      await updateIntakeStatus(INTAKE_TYPE_SLUG[row.type], row.id, status);
      await qc.invalidateQueries({ queryKey: adminIntakeKey() });
      addToast({ variant: 'success', title: `Status → ${status}` });
    } catch {
      addToast({ variant: 'error', title: 'Status update failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text disabled:opacity-40"
      >
        {busy ? '…' : 'Status ▾'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-white/10 bg-[#0f1923] shadow-xl">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void handle(s)}
                disabled={s === row.status}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text disabled:cursor-default disabled:text-brand-text"
              >
                {s}
                {s === row.status && <span className="text-brand-orange">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function InquiryDrawer({ row, onClose }: { row: IntakeRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative z-50 flex h-full w-96 flex-col overflow-y-auto border-l border-white/10 bg-[#0f1923] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-brand-text">
            Inquiry Details
          </h2>
          <button type="button" onClick={onClose} className="text-brand-muted hover:text-brand-text">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <Row label="Reference" value={row.referenceCode} mono />
          <Row label="Type">
            <span className={TYPE_COLORS[row.type]}>{TYPE_LABELS[row.type]}</span>
          </Row>
          <Row label="Contact" value={row.contact} />
          <Row label="Email" value={row.email} />
          <Row label="Subject" value={row.subject} />
          <Row label="Status"><IntakeStatusBadge status={row.status} /></Row>
          <Row label="Source" value={row.source} />
          <Row
            label="Date"
            value={new Date(row.createdAt).toLocaleString('en-AE')}
          />
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Update Status
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <StatusMenuButton key={s} row={row} status={s} onClose={onClose} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function StatusMenuButton({
  row, status, onClose,
}: { row: IntakeRow; status: IntakeStatus; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const { addToast } = useToastContext();
  const qc = useQueryClient();
  const isCurrent = row.status === status;

  const handle = async () => {
    setBusy(true);
    try {
      await updateIntakeStatus(INTAKE_TYPE_SLUG[row.type], row.id, status);
      await qc.invalidateQueries({ queryKey: adminIntakeKey() });
      addToast({ variant: 'success', title: `Status → ${status}` });
      onClose();
    } catch {
      addToast({ variant: 'error', title: 'Update failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isCurrent || busy}
      onClick={() => void handle()}
      className={[
        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        isCurrent
          ? 'border-brand-orange/40 bg-brand-orange/15 text-brand-orange'
          : 'border-white/10 text-brand-muted hover:bg-white/5 hover:text-brand-text',
      ].join(' ')}
    >
      {busy ? '…' : status}
    </button>
  );
}

function Row({ label, value, mono, children }: {
  label: string; value?: string; mono?: boolean; children?: React.ReactNode;
}) {
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

// ─── Status filter bar ────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: IntakeStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'RESPONDED', label: 'Responded' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'SPAM', label: 'Spam' },
];

const TYPE_FILTERS: { value: IntakeRow['type'] | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'quote_request', label: 'Quote Requests' },
  { value: 'product_inquiry', label: 'Product Inquiries' },
  { value: 'workshop_consultation', label: 'Workshop Leads' },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface InquiriesTableProps {
  items: IntakeRow[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
  statusFilter: IntakeStatus | '';
  onStatusFilter: (s: IntakeStatus | '') => void;
  typeFilter: IntakeRow['type'] | '';
  onTypeFilter: (t: IntakeRow['type'] | '') => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function InquiriesTable({
  items, isLoading, total, page, pageSize, totalPages, onPage,
  statusFilter, onStatusFilter, typeFilter, onTypeFilter,
}: InquiriesTableProps) {
  const [selected, setSelected] = useState<IntakeRow | null>(null);

  if (isLoading) return <AdminTableSkeleton rows={8} cols={6} />;

  return (
    <>
      {selected && (
        <InquiryDrawer row={selected} onClose={() => setSelected(null)} />
      )}

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { onTypeFilter(value); }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                typeFilter === value
                  ? 'border-brand-orange/50 bg-brand-orange/15 text-brand-orange'
                  : 'border-white/10 text-brand-muted hover:border-white/20 hover:text-brand-text',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { onStatusFilter(value); }}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === value
                  ? 'border-sky-400/50 bg-sky-400/15 text-sky-400'
                  : 'border-white/10 text-brand-muted hover:border-white/20 hover:text-brand-text',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Reference</AdminTh>
              <AdminTh>Type</AdminTh>
              <AdminTh>Contact</AdminTh>
              <AdminTh>Subject</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Date</AdminTh>
              <AdminTh className="text-right">Action</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No inquiries found" colSpan={7} />
          ) : (
            <AdminTbody>
              {items.map((row) => (
                <AdminTr key={row.id} onClick={() => setSelected(row)}>
                  <AdminTd>
                    <code className="font-mono text-xs text-brand-muted">
                      {row.referenceCode}
                    </code>
                  </AdminTd>
                  <AdminTd>
                    <span className={['text-xs font-medium', TYPE_COLORS[row.type]].join(' ')}>
                      {TYPE_LABELS[row.type]}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    <p className="max-w-[140px] truncate font-medium text-brand-text">
                      {row.contact}
                    </p>
                    <p className="max-w-[140px] truncate text-xs text-brand-muted">
                      {row.email}
                    </p>
                  </AdminTd>
                  <AdminTd>
                    <p className="max-w-[200px] truncate text-sm text-brand-muted">
                      {row.subject}
                    </p>
                  </AdminTd>
                  <AdminTd>
                    <IntakeStatusBadge status={row.status} />
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-brand-muted">
                      {formatDate(row.createdAt)}
                    </span>
                  </AdminTd>
                  <AdminTd className="text-right">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block"
                    >
                      <StatusMenu row={row} />
                    </div>
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
