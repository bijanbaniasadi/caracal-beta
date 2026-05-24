import Image from 'next/image';
import Link from 'next/link';

const FEATURED_ARTICLES = [
  {
    title: 'What is ECU Tuning?',
    category: 'Fundamentals',
    summary:
      'A complete introduction to ECU remapping — what the ECU controls, how tuning files modify its parameters, and what results are realistic on a stock engine.',
    cover: '/images/articles/what-is-ecu-tuning.png',
    slug: 'what-is-ecu-tuning',
  },
  {
    title: 'KESS3 — Full Device Guide',
    category: 'Hardware',
    summary:
      'Everything you need to know about the KESS3 interface: OBD coverage, bench protocols, boot modes, Alientech subscription tiers, and how to select Master vs Slave.',
    cover: '/images/articles/what-is-kess3.png',
    slug: 'what-is-kess3',
  },
  {
    title: 'DPF Off: The Complete Guide',
    category: 'Services',
    summary:
      'How DPF removal works at the software level, what ECU parameters are involved, pre-checks you must perform, and the diagnostic process before applying a delete.',
    cover: '/images/articles/dpf-off-service-dpf-off-solution.png',
    slug: 'dpf-off-service',
  },
  {
    title: 'EDC15 / EDC16 / EDC17 Tuning',
    category: 'Technical',
    summary:
      'A deep dive into the Bosch EDC family — architecture differences, injection and boost maps, torque limiters, and the parameter sets most commonly modified during stage tuning.',
    cover: '/images/articles/edc-15-16-17-tuning-guide.png',
    slug: 'edc-tuning-guide',
  },
];

export function ArticlesTeaser() {
  return (
    <section className="border-t border-white/10 bg-brand-bg py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
              Knowledge base
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">
              Technical Library
            </h2>
            <p className="mt-2 text-brand-muted">
              80+ in-depth articles on ECU tuning, diagnostics, and workshop operations.
            </p>
          </div>
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-brand-orange hover:underline"
          >
            Browse all articles
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Article grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_ARTICLES.map(({ title, category, summary, cover, slug }) => (
            <Link
              key={slug}
              href={`/articles#${slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-brand-orange/30"
            >
              {/* Cover image */}
              <div className="relative aspect-[16/9] overflow-hidden bg-brand-deep">
                <Image
                  src={cover}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <span className="font-technical text-xs font-semibold uppercase tracking-wider text-brand-orange/70">
                  {category}
                </span>
                <h3 className="font-display text-sm font-bold text-brand-text leading-snug group-hover:text-brand-orange transition-colors">
                  {title}
                </h3>
                <p className="flex-1 text-xs leading-relaxed text-brand-muted line-clamp-3">
                  {summary}
                </p>
                <span className="mt-1 text-xs font-medium text-brand-orange">
                  Read article →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
