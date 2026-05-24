'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminArticle, ArticleCreateInput, ArticleStatus } from '@/lib/api/admin-types';
type AdminArticleDetail = AdminArticle;
type AdminArticleInput = ArticleCreateInput;
import { useCreateArticle, useUpdateArticle } from '@/hooks/queries/use-admin-articles';
import { useToastContext } from '@/lib/toast/context';

interface ArticleFormProps {
  article?: AdminArticleDetail;
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-brand-text placeholder-brand-muted/50 outline-none transition-colors focus:border-brand-orange/50 focus:ring-1 focus:ring-brand-orange/30';

const selectCls =
  'w-full rounded-lg border border-white/10 bg-[#0f1923] px-3 py-2.5 text-sm text-brand-text outline-none focus:border-brand-orange/50';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-brand-muted">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const ARTICLE_CATEGORIES = [
  'Fundamentals', 'Hardware', 'Services', 'Software',
  'Technical', 'Business', 'Vehicle-Specific',
];

export function ArticleForm({ article }: ArticleFormProps) {
  const router = useRouter();
  const { addToast } = useToastContext();
  const isEdit = !!article;

  const [title, setTitle]           = useState(article?.title ?? '');
  const [slug, setSlug]             = useState(article?.slug ?? '');
  const [excerpt, setExcerpt]       = useState(article?.excerpt ?? '');
  const [content, setContent]       = useState(article?.contentHtml ?? '');
  const [status, setStatus]         = useState<ArticleStatus>(article?.status ?? 'DRAFT');
  const [category, setCategory]     = useState(article?.category ?? '');
  const [authorId, setAuthorId]     = useState(
    typeof article?.author === 'object' ? (article.author?.id ?? '') : '',
  );
  const [coverUrl, setCoverUrl]     = useState(article?.coverImage ?? '');
  const [tags, setTags]             = useState(article?.keywords?.join(', ') ?? '');
  const [seoTitle, setSeoTitle]     = useState(article?.seoTitle ?? '');
  const [seoDesc, setSeoDesc]       = useState(article?.seoDescription ?? '');
  const [error, setError]           = useState('');

  const createMut = useCreateArticle();
  const updateMut = useUpdateArticle(article?.id ?? '');
  const isPending = createMut.isPending || updateMut.isPending;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEdit && !slug) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const buildInput = (): AdminArticleInput => ({
    title,
    slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    excerpt: excerpt || undefined,
    contentHtml: content || undefined,
    status,
    category: category || undefined,
    authorId: authorId || undefined,
    coverImage: coverUrl || undefined,
    keywords: tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
    seoTitle: seoTitle || undefined,
    seoDescription: seoDesc || undefined,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isEdit) {
        await updateMut.mutateAsync(buildInput());
        addToast({ variant: 'success', title: 'Article updated' });
      } else {
        await createMut.mutateAsync(buildInput());
        addToast({ variant: 'success', title: 'Article created' });
        router.push('/admin/articles');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg);
      addToast({ variant: 'error', title: 'Save failed', description: msg });
    }
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Core */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          Article Content
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Title" required>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. What is ECU Remapping?"
                required
              />
            </Field>
          </div>
          <Field label="URL Slug">
            <input
              className={`${inputCls} font-mono`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated from title"
            />
          </Field>
          <Field label="Status">
            <select
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleStatus)}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Excerpt">
              <textarea
                className={`${inputCls} min-h-[72px] resize-y`}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary shown in article cards…"
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Content" required>
              <textarea
                className={`${inputCls} min-h-[300px] resize-y font-mono text-xs leading-relaxed`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Article body (Markdown or plain text)…"
                required
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Meta */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          Metadata
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Category">
            <select
              className={selectCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— Select —</option>
              {ARTICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Author ID (UUID)">
            <input
              className={inputCls}
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              placeholder="leave blank for anonymous"
            />
          </Field>
          <Field label="Tags (comma-separated)">
            <input
              className={inputCls}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ECU, tuning, KESS3"
            />
          </Field>
          <div className="md:col-span-3">
            <Field label="Cover Image URL">
              <input
                className={inputCls}
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://… or /images/articles/…"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* SEO */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-brand-muted">
          SEO
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <Field label="SEO Title">
            <input
              className={inputCls}
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Overrides title for search engines"
            />
          </Field>
          <Field label="SEO Description">
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
              placeholder="Max 160 characters for search snippets…"
            />
          </Field>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand-orange px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : isEdit ? 'Update Article' : 'Create Article'}
        </button>
      </div>
    </form>
  );
}
