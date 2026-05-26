'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminProducts } from '@/hooks/queries/use-admin-products';
import { ProductTable } from '@/components/admin/products/product-table';

function webSearchUrl(query: string) {
  const trimmed = query.trim();

  if (!trimmed) return null;

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export default function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;
  const webLookup = webSearchUrl(search);

  const { data, isLoading } = useAdminProducts({ page, pageSize, search: search || undefined });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search local catalog..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        {webLookup ? (
          <a
            href={webLookup}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text"
          >
            Search web
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-brand-muted opacity-40"
          >
            Search web
          </button>
        )}
        <div className="flex-1" />
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          + New Product
        </Link>
      </div>

      <ProductTable
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
