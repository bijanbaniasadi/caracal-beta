import Link from 'next/link';

interface ServiceTopicPageProps {
  eyebrow: string;
  title: string;
  description: string;
  waContext?: string; // pre-filled WhatsApp message context
  tags: string[];
  points: string[];
  cards: Array<{
    label: string;
    title: string;
    text: string;
  }>;
  relatedArticles?: Array<{
    slug: string;
    title: string;
    category: string;
    summary: string;
  }>;
}

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Caracaltech+Motors+LLC/@25.2645178,55.3325059,17.55z/data=!4m6!3m5!1s0x3e5f5db936da9f23:0x2f4212cc1172b758!8m2!3d25.26373!4d55.333424!16s%2Fg%2F11yt004nkq';

export function ServiceTopicPage({
  eyebrow,
  title,
  description,
  waContext,
  tags,
  points,
  cards,
  relatedArticles = [],
}: ServiceTopicPageProps) {
  const waText = encodeURIComponent(
    waContext ?? `Hi, I need workshop support for ${title}`
  );

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-brand-text sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted sm:text-base">
              {description}
            </p>

            {/* Trust line */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-brand-muted">
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-yellow-400 hover:underline"
              >
                ★★★★★
                <span className="text-brand-muted">5.0 · 14 Google reviews</span>
              </a>
              <span>Office 117, Deira, Dubai</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/971585796760?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                <WhatsAppIcon />
                WhatsApp Workshop Quote
              </a>
              <Link
                href="/knowledge"
                className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-white/5"
              >
                Technical Library
              </Link>
              <Link
                href="/shop"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-brand-muted hover:bg-white/5 hover:text-brand-text"
              >
                Shop Hardware
              </Link>
            </div>
          </div>

          {/* B2B trust sidebar */}
          <aside className="rounded-lg border border-white/10 bg-white/5 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-brand-text">UAE workshop support</p>
              <p className="mt-2 text-xs leading-5 text-brand-muted">
                Dubai-based technical review for ECU, TCU, IMMO, DPF, AdBlue, and EGR jobs.
                Remote file requests are reviewed before any paid work is accepted.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              {[
                { v: 'KESS3', l: 'OBD / Bench' },
                { v: 'AutoTuner', l: 'OBD & BDM' },
                { v: 'BFlash', l: 'Bench flash' },
                { v: 'Boot / BDM', l: 'Pin-level' },
              ].map(({ v, l }) => (
                <div key={v} className="text-xs">
                  <p className="font-semibold text-brand-text">{v}</p>
                  <p className="text-brand-muted">{l}</p>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-white/10">
              <a
                href={`https://wa.me/971585796760?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:underline"
              >
                <WhatsAppIcon />
                058 579 6760 — Typically reply within 1h
              </a>
            </div>
          </aside>
        </div>
      </section>

      {/* ── Technical detail ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
              Technical overview
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold text-brand-text">
              What this service covers
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <ul className="space-y-4 text-sm leading-6 text-brand-muted">
              {points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand-orange" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Service cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article key={card.title} className="rounded-lg border border-white/10 bg-white/5 p-5">
              <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/80">
                {card.label}
              </p>
              <h3 className="mt-3 font-display text-lg font-bold text-brand-text">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-brand-muted">{card.text}</p>
            </article>
          ))}
        </div>

        {/* Related knowledge articles */}
        {relatedArticles.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-brand-text">Related Guides</h2>
              <Link href="/knowledge" className="text-sm font-medium text-brand-orange hover:underline">
                Browse all →
              </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {relatedArticles.map(({ slug, title: artTitle, category, summary }) => (
                <Link
                  key={slug}
                  href={`/knowledge/${slug}`}
                  className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:border-brand-orange/40"
                >
                  <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/80">
                    {category}
                  </p>
                  <h3 className="mt-2 font-display text-sm font-bold leading-snug text-brand-text group-hover:text-brand-orange">
                    {artTitle}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-brand-muted">{summary}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Footer WhatsApp CTA band */}
        <div className="mt-14 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-6 text-center">
          <p className="font-display text-lg font-bold text-brand-text">
            Ready to send a job or get a quote?
          </p>
          <p className="mt-2 text-sm text-brand-muted">
            UAE business hours Sun–Thu 9AM–6PM. Most file jobs returned within 24–48 hours.
          </p>
          <a
            href={`https://wa.me/971585796760?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-orange px-7 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <WhatsAppIcon />
            WhatsApp us now — 058 579 6760
          </a>
        </div>
      </section>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
