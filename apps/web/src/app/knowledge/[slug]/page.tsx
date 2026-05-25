import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  getLegacyArticle,
  getLegacyArticleImage,
  getLegacyArticles,
  sanitizeLegacyArticleHtml,
  type LegacyArticle,
} from '@/lib/content/legacy-articles';

// ─── Related service mapping ──────────────────────────────────────────────────

const SERVICE_LINKS: Array<{ label: string; href: string; keywords: string[] }> = [
  {
    label: 'ECU Remapping Dubai',
    href: '/ecu-remapping-dubai',
    keywords: ['remap', 'remapping', 'stage', 'tuning', 'petrol', 'diesel', 'dyno', 'boost', 'edc', 'torque'],
  },
  {
    label: 'DPF · EGR · AdBlue Services',
    href: '/immo-dpf-adblue-services',
    keywords: ['dpf', 'egr', 'adblue', 'scr', 'emissions', 'decat', 'lambda', 'o2 sensor'],
  },
  {
    label: 'IMMO Off & Key Services',
    href: '/immo-dpf-adblue-services',
    keywords: ['immo', 'immobiliser', 'key', 'transponder', 'pin', 'cloning'],
  },
  {
    label: 'ECU Tuning File Service',
    href: '/ecu-tuning',
    keywords: ['file service', 'tuning file', 'chiptuning', 'winols', 'ecm titanium', 'slave', 'checksum'],
  },
];

function getRelatedServices(article: LegacyArticle): Array<{ label: string; href: string }> {
  const searchText = `${article.slug} ${article.title} ${article.keywords.join(' ')}`.toLowerCase();
  const matches = SERVICE_LINKS.filter((s) =>
    s.keywords.some((kw) => searchText.includes(kw))
  );
  // Dedupe by href
  const seen = new Set<string>();
  return matches.filter(({ href }) => {
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}

function getRelatedArticles(current: LegacyArticle, all: LegacyArticle[]): LegacyArticle[] {
  return all
    .filter((a) => a.slug !== current.slug && !a.hidden)
    .filter((a) => a.category === current.category || a.featured || a.landing)
    .slice(0, 3);
}

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
  const allArticles = getLegacyArticles();
  const relatedServices = getRelatedServices(article);
  const relatedArticles = getRelatedArticles(article, allArticles);

  // Pre-filled WhatsApp message uses the article title for context
  const waMessage = encodeURIComponent(
    `Hi, I read your article on "${article.title}" and need help with a workshop job`
  );

  return (
    <article className="min-h-screen bg-brand-bg">
      <section className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <Link
              href="/knowledge"
              className="text-sm font-semibold text-brand-orange hover:underline"
            >
              ← Knowledge Base
            </Link>
            <p className="mt-4 font-technical text-xs font-semibold uppercase tracking-widest text-brand-muted">
              {article.category} · Updated {article.updatedDate}
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
            {/* Related service links in header */}
            {relatedServices.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {relatedServices.map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-full border border-brand-orange/30 bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange transition-colors hover:bg-brand-orange/20"
                  >
                    {label} →
                  </Link>
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
        {/* Inline WhatsApp nudge — appears after 3rd paragraph in the reading flow */}
        <div className="mb-8 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-xs text-brand-muted">
            Need help applying this?
          </span>
          <a
            href={`https://wa.me/971585796760?text=${waMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto whitespace-nowrap rounded-md bg-brand-orange px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Ask on WhatsApp
          </a>
        </div>

        <div
          className="legacy-article-content text-sm leading-7 text-brand-muted"
          dangerouslySetInnerHTML={{ __html: sanitizeLegacyArticleHtml(article.bodyHtml) }}
        />

        {/* Workshop CTA — bottom of article */}
        <div className="mt-10 rounded-lg border border-brand-orange/30 bg-brand-orange/10 p-5">
          <p className="font-display text-lg font-bold text-brand-text">
            Need help applying this to a real ECU or workshop job?
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-muted">
            Send the vehicle details, ECU family, tool, and file context — the team will confirm
            compatibility and advise the safest next step.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/971585796760?text=${waMessage}`}
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
              Submit Workshop Request
            </Link>
          </div>
          {/* Related services */}
          {relatedServices.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-brand-muted">Related services:</span>
              {relatedServices.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-xs font-semibold text-brand-orange hover:underline"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-xl font-bold text-brand-text">Related Articles</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {relatedArticles.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/knowledge/${rel.slug}`}
                  className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:border-brand-orange/40"
                >
                  <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/80">
                    {rel.category}
                  </p>
                  <h3 className="mt-2 font-display text-sm font-bold leading-snug text-brand-text group-hover:text-brand-orange">
                    {rel.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-brand-muted">
                    {rel.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </article>
  );
}
