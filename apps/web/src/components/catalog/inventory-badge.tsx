import type { InventoryStatus } from '@/lib/api/catalog-types';

interface InventoryBadgeProps {
  status: InventoryStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  InventoryStatus,
  { label: string; className: string }
> = {
  IN_STOCK: {
    label: 'In Stock',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  LOW_STOCK: {
    label: 'Low Stock',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
  DISCONTINUED: {
    label: 'Discontinued',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
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
        'inline-flex items-center rounded-full border border-violet-200',
        'bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700',
        className,
      ].join(' ')}
    >
      Trade Only
    </span>
  );
}
