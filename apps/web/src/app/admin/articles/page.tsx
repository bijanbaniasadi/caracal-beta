'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminArticles } from '@/hooks/queries/use-admin-articles';
import { ArticleTable } from '@/components/admin/articles/article-table';

export default function AdminArticlesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const { data, isLoading } = useAdminArticles({ page, pageSize, search: search || undefined });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search articles…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-64 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-text placeholder-brand-muted/50 outline-none focus:border-brand-orange/50"
        />
        <div className="flex-1" />
        <Link
          href="/admin/articles/new"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          + New Article
        </Link>
      </div>

      <ArticleTable
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
