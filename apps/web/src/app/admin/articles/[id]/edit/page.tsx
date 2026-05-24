'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAdminArticle } from '@/hooks/queries/use-admin-articles';
import { ArticleForm } from '@/components/admin/articles/article-form';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditArticlePage({ params }: Props) {
  const { id } = use(params);
  const { data: article, isLoading, isError } = useAdminArticle(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminTableSkeleton rows={5} cols={2} />
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm text-brand-muted">Article not found.</p>
        <Link href="/admin/articles" className="mt-4 inline-block text-sm text-brand-orange hover:underline">
          Back to articles
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-lg font-bold text-brand-text">
        Edit: {article.title}
      </h2>
      <ArticleForm article={article} />
    </div>
  );
}
