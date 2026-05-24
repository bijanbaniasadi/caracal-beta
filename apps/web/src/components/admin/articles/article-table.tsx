'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AdminArticleListItem } from '@/lib/api/admin-types';
import {
  AdminTable, AdminThead, AdminTh, AdminTbody, AdminTr, AdminTd,
  AdminTableEmpty, AdminPagination,
} from '@/components/admin/ui/admin-table';
import { ArticleStatusBadge } from '@/components/admin/ui/admin-badge';
import { AdminTableSkeleton } from '@/components/admin/ui/admin-skeleton';
import { ConfirmModal } from '@/components/admin/ui/confirm-modal';
import { useDeleteArticle, useUpdateArticle } from '@/hooks/queries/use-admin-articles';
import { useToastContext } from '@/lib/toast/context';

interface ArticleTableProps {
  items: AdminArticleListItem[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPage: (p: number) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function TogglePublish({ article }: { article: AdminArticleListItem }) {
  const { mutateAsync, isPending } = useUpdateArticle(article.id);
  const { addToast } = useToastContext();
  const isPublished = article.status === 'PUBLISHED';

  const toggle = async () => {
    try {
      await mutateAsync({ status: isPublished ? 'DRAFT' : 'PUBLISHED' });
      addToast({ variant: 'success', title: isPublished ? 'Unpublished' : 'Published' });
    } catch {
      addToast({ variant: 'error', title: 'Status update failed' });
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => { void toggle(); }}
      className={[
        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
        isPublished
          ? 'border-amber-400/20 text-amber-400 hover:bg-amber-400/10'
          : 'border-green-500/20 text-green-400 hover:bg-green-500/10',
      ].join(' ')}
    >
      {isPending ? '…' : isPublished ? 'Unpublish' : 'Publish'}
    </button>
  );
}

export function ArticleTable({
  items, isLoading, total, page, pageSize, totalPages, onPage,
}: ArticleTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { mutateAsync: deleteArticle, isPending: isDeleting } = useDeleteArticle();
  const { addToast } = useToastContext();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteArticle(deleteId);
      addToast({ variant: 'success', title: 'Article deleted' });
    } catch {
      addToast({ variant: 'error', title: 'Delete failed' });
    } finally {
      setDeleteId(null);
    }
  };

  if (isLoading) return <AdminTableSkeleton rows={6} cols={6} />;

  return (
    <>
      <ConfirmModal
        open={!!deleteId}
        title="Delete article"
        message="This will permanently remove the article and cannot be undone."
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setDeleteId(null)}
      />

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Title</AdminTh>
              <AdminTh>Category</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Author</AdminTh>
              <AdminTh>Published</AdminTh>
              <AdminTh className="text-right">Actions</AdminTh>
            </tr>
          </AdminThead>

          {items.length === 0 ? (
            <AdminTableEmpty message="No articles found" colSpan={6} />
          ) : (
            <AdminTbody>
              {items.map((article) => (
                <AdminTr key={article.id}>
                  <AdminTd>
                    <p className="max-w-[260px] truncate font-medium text-brand-text">
                      {article.title}
                    </p>
                    <code className="text-xs text-brand-muted">/{article.slug}</code>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-brand-muted">
                      {article.category ?? '—'}
                    </span>
                  </AdminTd>
                  <AdminTd><ArticleStatusBadge status={article.status} /></AdminTd>
                  <AdminTd>
                    <span className="text-sm text-brand-muted">
                      {article.author?.name ?? article.author?.email ?? '—'}
                    </span>
                  </AdminTd>
                  <AdminTd>
                    <span className="text-xs text-brand-muted">
                      {article.publishedAt ? formatDate(article.publishedAt) : '—'}
                    </span>
                  </AdminTd>
                  <AdminTd className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <TogglePublish article={article} />
                      <Link
                        href={`/admin/articles/${article.id}/edit`}
                        className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteId(article.id)}
                        className="rounded-md border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </AdminTd>
                </AdminTr>
              ))}
            </AdminTbody>
          )}
        </AdminTable>

        {totalPages > 1 && (
          <AdminPagination
            page={page} totalPages={totalPages}
            total={total} pageSize={pageSize} onPage={onPage}
          />
        )}
      </div>
    </>
  );
}
