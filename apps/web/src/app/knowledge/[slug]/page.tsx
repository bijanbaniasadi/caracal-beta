import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  getLegacyArticle,
  getLegacyArticleImage,
  getLegacyArticles,
  sanitizeLegacyArticleHtml,
} from '@/lib/content/legacy-articles';

interface KnowledgeArticlePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getLegacyArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: KnowledgeArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getLegacyArticle(slug);

  if (!article) {
    return {
      title: 'Knowledge Article',
    };
  }

  const image = getLegacyArticleImage(article);

  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    alternates: {
      canonical: `/knowledge/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.updatedAt,
      modifiedTime: article.updatedAt,
      images: image ? [{ url: image, alt: article.title }] : undefined,
    },
  };
}

export default async function KnowledgeArticlePage({ params }: KnowledgeArticlePageProps) {
  const { slug } = await params;
  const article = getLegacyArticle(slug);

  if (!article) {
    notFound();
  }

  const image = getLegacyArticleImage(article);

  return (
    <article className="min-h-screen bg-brand-bg">
      <section className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <Link
              href="/knowledge"
              className="text-sm font-semibold text-brand-orange hover:underline"
            >
              Knowledge Base
            </Link>
            <p className="mt-4 font-technical text-xs font-semibold uppercase tracking-widest text-brand-muted">
              {article.category} | Updated {article.updatedDate}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-brand-text sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted sm:text-base">
              {article.description}
            </p>
            {article.keywords.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {article.keywords.slice(0, 8).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-muted"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>

          {image && (
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <Image src={image} alt={article.title} fill className="object-cover" priority />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div
          className="legacy-article-content text-sm leading-7 text-brand-muted"
          dangerouslySetInnerHTML={{ __html: sanitizeLegacyArticleHtml(article.bodyHtml) }}
        />

        <div className="mt-10 rounded-lg border border-brand-orange/30 bg-brand-orange/10 p-5">
          <p className="font-display text-lg font-bold text-brand-text">
            Need help applying this to a real ECU or workshop job?
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Send the vehicle, ECU family, tool, and file context and the team will advise the safest
            next step.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://wa.me/971585796760?text=Hi%2C%20I%20need%20technical%20help%20with%20an%20ECU%20job"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Ask on WhatsApp
            </a>
            <Link
              href="/contact"
              className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-white/5"
            >
              Open Request Form
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
