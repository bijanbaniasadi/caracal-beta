'use client';

import { useState } from 'react';
import { useAdminInventory } from '@/hooks/queries/use-admin-inventory';
import { InventoryEditor } from '@/components/admin/inventory/inventory-editor';

export default function AdminInventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 30;

  const { data, isLoading } = useAdminInventory({
    page,
    pageSize,
    search: search || undefined,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by product name or SKU…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-72 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        <p className="ml-auto text-sm text-brand-muted">
          {isLoading ? '…' : `${data?.total ?? 0} products`}
        </p>
      </div>

      <InventoryEditor
        items={data?.items ?? []}
        isLoading={isLoading}
        total={data?.total ?? 0}
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? pageSize}
        totalPages={data?.totalPages ?? 0}
        onPage={setPage}
      />
    </div>
  );
}
