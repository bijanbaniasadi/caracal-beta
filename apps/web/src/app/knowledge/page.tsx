import type { Metadata } from 'next';
import Link from 'next/link';

import { getLegacyArticles } from '@/lib/content/legacy-articles';

export const metadata: Metadata = {
  title: 'ECU Tuning Knowledge Base',
  description:
    'Legacy Caracal Tech Motors technical library covering ECU remapping, tuning tools, WinOLS, DPF, AdBlue, EGR, IMMO, diagnostics, and workshop workflows.',
  alternates: {
    canonical: '/knowledge',
  },
};

export default function KnowledgeIndexPage() {
  const articles = getLegacyArticles();
  const featured = articles.filter((article) => article.featured || article.landing).slice(0, 12);
  const rest = articles.filter((article) => !featured.includes(article));

  return (
    <div className="min-h-screen bg-brand-bg">
      <section className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
            Knowledge Base
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">
            ECU Tuning Technical Library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted sm:text-base">
            Preserved Caracal Tech Motors guides for ECU remapping, tuning tools, calibration
            software, diesel solutions, diagnostics, and workshop operations.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        {featured.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-brand-text">Featured Guides</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl font-bold text-brand-text">All Articles</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: ReturnType<typeof getLegacyArticles>[number] }) {
  return (
    <Link
      href={`/knowledge/${article.slug}`}
      className="group rounded-lg border border-white/10 bg-white/5 p-5 transition-colors hover:border-brand-orange/40"
    >
      <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/80">
        {article.category}
      </p>
      <h3 className="mt-3 font-display text-base font-bold leading-snug text-brand-text group-hover:text-brand-orange">
        {article.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-brand-muted">{article.description}</p>
      <p className="mt-4 text-xs text-brand-muted">Updated {article.updatedDate}</p>
    </Link>
  );
}
