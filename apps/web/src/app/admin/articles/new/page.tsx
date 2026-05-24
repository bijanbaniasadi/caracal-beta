import { ArticleForm } from '@/components/admin/articles/article-form';

export default function NewArticlePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-lg font-bold text-brand-text">
        New Article
      </h2>
      <ArticleForm />
    </div>
  );
}
