import Link from 'next/link';

interface ServiceTopicPageProps {
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  points: string[];
  cards: Array<{
    label: string;
    title: string;
    text: string;
  }>;
}

export function ServiceTopicPage({
  eyebrow,
  title,
  description,
  tags,
  points,
  cards,
}: ServiceTopicPageProps) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <section className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
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
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://wa.me/971585796760?text=Hi%2C%20I%20need%20technical%20workshop%20support"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Request Workshop Review
              </a>
              <Link
                href="/knowledge"
                className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-white/5"
              >
                Open Technical Library
              </Link>
              <Link
                href="/contact"
                className="rounded-md border border-white/10 px-5 py-2.5 text-sm font-semibold text-brand-muted hover:bg-white/5 hover:text-brand-text"
              >
                Submit Request
              </Link>
            </div>
          </div>

          <aside className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-brand-text">UAE workshop support</p>
            <div className="mt-4 grid gap-3 text-sm text-brand-muted">
              <p>Dubai-based technical review for ECU, TCU, IMMO, DPF, AdBlue, and EGR jobs.</p>
              <p>
                Hardware orders can include UAE shipping, supplier warranty checks, and
                compatibility confirmation.
              </p>
              <p>Remote file requests are reviewed before any paid work is accepted.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
              Technical overview
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold text-brand-text">
              What this page helps clarify
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
      </section>
    </div>
  );
}
