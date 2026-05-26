/**
 * Status Badge - Inventory Status Indicator
 * Visual indicator for product availability status
 * Location: apps/web/src/components/catalog/status-badge.tsx
 */

'use client';

import type { InventoryStatus } from '@/lib/api/catalog-types';

type StockStatus = InventoryStatus | 'LIMITED' | 'BACKORDER';

interface StatusBadgeProps {
  status: StockStatus;
  isCompact?: boolean;
}

const statusConfig: Record<StockStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  IN_STOCK: {
    label: 'In Stock',
    color: 'text-green-400',
    bgColor: 'bg-green-900/20 border-green-900/30',
    icon: '✓',
  },
  LIMITED: {
    label: 'Limited',
    color: 'text-amber-400',
    bgColor: 'bg-amber-900/20 border-amber-900/30',
    icon: '⚠',
  },
  LOW_STOCK: {
    label: 'Low Stock',
    color: 'text-amber-400',
    bgColor: 'bg-amber-900/20 border-amber-900/30',
    icon: '!',
  },
  BACKORDER: {
    label: 'Backorder',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20 border-blue-900/30',
    icon: '⟳',
  },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    color: 'text-red-400',
    bgColor: 'bg-red-900/20 border-red-900/30',
    icon: '✕',
  },
  DISCONTINUED: {
    label: 'Discontinued',
    color: 'text-slate-400',
    bgColor: 'bg-slate-900/20 border-slate-900/30',
    icon: '–',
  },
};

export function InventoryBadge({ status, isCompact = false }: StatusBadgeProps) {
  const config = statusConfig[status];

  if (isCompact) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold border ${config.bgColor} ${config.color}`}
        title={config.label}
      >
        {config.icon}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold border ${config.bgColor} ${config.color}`}
    >
      <span className="font-bold">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
