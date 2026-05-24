import type { InventoryStatus } from '@/lib/api/catalog-types';

interface InventoryBadgeProps {
  status: InventoryStatus;
  className?: string;
}

const STATUS_CONFIG: Record<InventoryStatus, { label: string; className: string }> = {
  IN_STOCK: {
    label: 'In Stock',
    className: 'bg-brand-green/15 text-brand-green border-brand-green/30',
  },
  LOW_STOCK: {
    label: 'Low Stock',
    className: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
  },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    className: 'bg-red-500/15 text-red-400 border-red-400/30',
  },
  DISCONTINUED: {
    label: 'Discontinued',
    className: 'bg-white/5 text-brand-muted border-white/10',
  },
};

export function InventoryBadge({ status, className = '' }: InventoryBadgeProps) {
  const { label, className: statusCls } = STATUS_CONFIG[status];
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5',
        'text-xs font-medium',
        statusCls,
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

export function TradeOnlyBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border border-violet-500/30',
        'bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300',
        className,
      ].join(' ')}
    >
      Trade Only
    </span>
  );
}
