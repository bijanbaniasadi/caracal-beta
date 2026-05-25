import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface LegacyArticle {
  legacyId: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  updatedAt: string;
  updatedDate: string;
  featured: boolean;
  landing: boolean;
  hidden: boolean;
  coverImage: string;
  thumbnail: string;
  keywords: string[];
  bodyHtml: string;
}

interface LegacyArticleSeed {
  articles: LegacyArticle[];
}

let articleCache: LegacyArticle[] | null = null;

function articleSeedPath(): string {
  const candidates = [
    path.resolve(process.cwd(), '../../docs/legacy-migration/articles.seed.json'),
    path.resolve(process.cwd(), 'docs/legacy-migration/articles.seed.json'),
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('Legacy article seed JSON was not found.');
  }

  return found;
}

export function getLegacyArticles(): LegacyArticle[] {
  if (articleCache) {
    return articleCache;
  }

  const seed = JSON.parse(readFileSync(articleSeedPath(), 'utf8')) as LegacyArticleSeed;
  articleCache = seed.articles.filter((article) => !article.hidden);
  return articleCache;
}

export function getLegacyArticle(slug: string): LegacyArticle | undefined {
  return getLegacyArticles().find((article) => article.slug === slug);
}

export function getLegacyArticleImage(article: LegacyArticle): string | null {
  const candidates = [
    `/images/articles/${article.slug}.png`,
    `/images/articles/${path.basename(article.coverImage)}`,
  ];

  return (
    candidates.find((candidate) =>
      existsSync(path.join(process.cwd(), 'public', candidate.replace(/^\//, '')))
    ) ?? null
  );
}

export function sanitizeLegacyArticleHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\s(href|src)=(["'])javascript:.*?\2/gi, '');
}
