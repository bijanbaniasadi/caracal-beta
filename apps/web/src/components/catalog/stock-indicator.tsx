import type { ProductInventory, InventoryStatus } from '@/lib/api/catalog-types';

interface StockIndicatorProps {
  inventory: ProductInventory;
  /** Compact mode for product cards */
  compact?: boolean;
}

const DOT: Record<InventoryStatus, string> = {
  IN_STOCK:     'bg-brand-green',
  LOW_STOCK:    'bg-amber-400',
  OUT_OF_STOCK: 'bg-red-500',
  DISCONTINUED: 'bg-white/30',
};

export function StockIndicator({ inventory, compact = false }: StockIndicatorProps) {
  const { status, quantityAvailable } = inventory;

  if (compact) {
    const label = {
      IN_STOCK:     'In Stock',
      LOW_STOCK:    `${quantityAvailable} left`,
      OUT_OF_STOCK: 'Out of Stock',
      DISCONTINUED: 'Discontinued',
    }[status];

    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
        <span className="text-xs text-brand-muted">{label}</span>
      </span>
    );
  }

  // ── Full indicator ──────────────────────────────────────────────────────────

  if (status === 'IN_STOCK') {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-green" />
        </span>
        <span className="text-sm font-medium text-brand-green">In Stock</span>
        <span className="text-xs text-brand-muted">— Ships same day from Dubai</span>
      </div>
    );
  }

  if (status === 'LOW_STOCK') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="text-sm font-medium text-amber-400">Low Stock</span>
          {quantityAvailable > 0 && (
            <span className="text-xs text-brand-muted">— Only {quantityAvailable} remaining</span>
          )}
        </div>
        <p className="text-xs text-amber-400/70">Order soon to avoid waiting for restock</p>
      </div>
    );
  }

  if (status === 'OUT_OF_STOCK') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
          <span className="text-sm font-medium text-red-400">Out of Stock</span>
        </div>
        <p className="text-xs text-brand-muted">
          Enquire via WhatsApp — we can source or provide an ETA
        </p>
      </div>
    );
  }

  // DISCONTINUED
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-white/30" aria-hidden="true" />
      <span className="text-sm text-brand-muted">Discontinued</span>
    </div>
  );
}
