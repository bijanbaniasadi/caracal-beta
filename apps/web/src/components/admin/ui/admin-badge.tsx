import type { IntakeStatus, BinUploadStatus } from '@/lib/api/types';
import type { InventoryStatus, ProductStatus } from '@/lib/api/catalog-types';
import type { ArticleStatus } from '@/lib/api/admin-types';

type BadgeVariant =
  | 'green' | 'amber' | 'red' | 'violet' | 'sky' | 'gray' | 'orange';

const variantClasses: Record<BadgeVariant, string> = {
  green:  'bg-green-500/15 text-green-400 border-green-500/30',
  amber:  'bg-amber-400/15 text-amber-400 border-amber-400/30',
  red:    'bg-red-500/15 text-red-400 border-red-400/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  sky:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
  gray:   'bg-white/5 text-brand-muted border-white/10',
  orange: 'bg-brand-orange/15 text-brand-orange border-brand-orange/30',
};

interface AdminBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function AdminBadge({ variant = 'gray', children, className = '' }: AdminBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

// ─── Domain-specific badges ───────────────────────────────────────────────────

export function IntakeStatusBadge({ status }: { status: IntakeStatus }) {
  const map: Record<IntakeStatus, { label: string; variant: BadgeVariant }> = {
    NEW:       { label: 'New',       variant: 'sky' },
    IN_REVIEW: { label: 'In Review', variant: 'amber' },
    RESPONDED: { label: 'Responded', variant: 'green' },
    CLOSED:    { label: 'Closed',    variant: 'gray' },
    SPAM:      { label: 'Spam',      variant: 'red' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <AdminBadge variant={variant}>{label}</AdminBadge>;
}

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  const map: Record<InventoryStatus, { label: string; variant: BadgeVariant }> = {
    IN_STOCK:     { label: 'In Stock',     variant: 'green' },
    LOW_STOCK:    { label: 'Low Stock',    variant: 'amber' },
    OUT_OF_STOCK: { label: 'Out of Stock', variant: 'red' },
    DISCONTINUED: { label: 'Discontinued', variant: 'gray' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <AdminBadge variant={variant}>{label}</AdminBadge>;
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const map: Record<ProductStatus, { label: string; variant: BadgeVariant }> = {
    ACTIVE:   { label: 'Active',   variant: 'green' },
    DRAFT:    { label: 'Draft',    variant: 'amber' },
    ARCHIVED: { label: 'Archived', variant: 'gray' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <AdminBadge variant={variant}>{label}</AdminBadge>;
}

export function ArticleStatusBadge({ status }: { status: ArticleStatus }) {
  const map: Record<ArticleStatus, { label: string; variant: BadgeVariant }> = {
    PUBLISHED: { label: 'Published', variant: 'green' },
    DRAFT:     { label: 'Draft',     variant: 'amber' },
    ARCHIVED:  { label: 'Archived',  variant: 'gray' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <AdminBadge variant={variant}>{label}</AdminBadge>;
}

export function BinUploadStatusBadge({ status }: { status: BinUploadStatus }) {
  const map: Record<BinUploadStatus, { label: string; variant: BadgeVariant }> = {
    RECEIVED:  { label: 'Received',  variant: 'sky' },
    VALIDATED: { label: 'Validated', variant: 'green' },
    REJECTED:  { label: 'Rejected',  variant: 'red' },
    STORED:    { label: 'Stored',    variant: 'violet' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <AdminBadge variant={variant}>{label}</AdminBadge>;
}
