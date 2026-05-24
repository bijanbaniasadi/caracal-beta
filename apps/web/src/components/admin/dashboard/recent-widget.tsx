import Link from 'next/link';
import { IntakeStatusBadge, BinUploadStatusBadge } from '@/components/admin/ui/admin-badge';
import { SkeletonLine } from '@/components/admin/ui/admin-skeleton';
import type { IntakeRow } from '@/lib/api/admin-types';
import type { BinUploadRecord } from '@/lib/api/admin-types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Recent inquiries ─────────────────────────────────────────────────────────

interface RecentInquiriesProps {
  items: IntakeRow[];
  isLoading: boolean;
}

export function RecentInquiries({ items, isLoading }: RecentInquiriesProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className="font-display text-sm font-bold text-brand-text">
          Recent Inquiries
        </h2>
        <Link
          href="/admin/inquiries"
          className="text-xs font-medium text-brand-orange hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="divide-y divide-white/5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <SkeletonLine className="h-3 w-24" />
              <SkeletonLine className="h-3 w-32 flex-1" />
              <SkeletonLine className="h-4 w-16 rounded-full" />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-brand-muted">
            No inquiries yet
          </p>
        ) : (
          items.slice(0, 5).map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-brand-text">
                  {row.contact}
                </p>
                <p className="truncate text-xs text-brand-muted">{row.subject}</p>
              </div>
              <IntakeStatusBadge status={row.status} />
              <span className="whitespace-nowrap text-xs text-brand-muted">
                {formatDate(row.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ─── Recent uploads ───────────────────────────────────────────────────────────

interface RecentUploadsProps {
  items: BinUploadRecord[];
  isLoading: boolean;
}

export function RecentUploads({ items, isLoading }: RecentUploadsProps) {
  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className="font-display text-sm font-bold text-brand-text">
          Recent BIN Uploads
        </h2>
        <Link
          href="/admin/uploads"
          className="text-xs font-medium text-brand-orange hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="divide-y divide-white/5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <SkeletonLine className="h-3 w-36 flex-1" />
              <SkeletonLine className="h-4 w-16 rounded-full" />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-brand-muted">
            No uploads yet
          </p>
        ) : (
          items.slice(0, 5).map((upload) => (
            <div key={upload.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-medium text-brand-text">
                  {upload.originalFileName}
                </p>
                <p className="text-xs text-brand-muted">
                  {formatBytes(upload.byteSize)} · {upload.storageProvider}
                </p>
              </div>
              <BinUploadStatusBadge status={upload.status} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
