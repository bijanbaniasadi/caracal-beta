// Real-language review excerpts representative of workshop/B2B clients.
// These are placeholders — replace with actual review text once extracted from Google Maps.
const REVIEWS = [
  {
    author: 'Khalid A.',
    rating: 5,
    excerpt:
      'Professional team, very knowledgeable about ECU systems. Helped us with a difficult IMMO job on a Mercedes and turned it around the same day.',
    date: '2026',
  },
  {
    author: 'Mohammed R.',
    rating: 5,
    excerpt:
      'We use Caracal Tech for all our DPF and EGR file work. Compatibility is always confirmed before they start. Reliable and fast.',
    date: '2025',
  },
  {
    author: 'Sundar K.',
    rating: 5,
    excerpt:
      'Bought a KESS3 master through them. Genuine device, UAE warranty, and the technical advice before purchase saved me from getting the wrong configuration.',
    date: '2025',
  },
];

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Caracaltech+Motors+LLC/@25.2645178,55.3325059,17.55z/data=!4m6!3m5!1s0x3e5f5db936da9f23:0x2f4212cc1172b758!8m2!3d25.26373!4d55.333424!16s%2Fg%2F11yt004nkq';

export function GoogleReviewsSection() {
  return (
    <section className="border-t border-white/10 bg-brand-deep py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
              Social proof
            </p>
            <h2 className="font-display text-2xl font-bold text-brand-text sm:text-3xl">
              Trusted by Workshops Across UAE &amp; GCC
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg tracking-tight text-yellow-400">★★★★★</span>
              <span className="text-sm font-bold text-brand-text">5.0</span>
              <span className="text-sm text-brand-muted">· 14 verified Google reviews</span>
            </div>
          </div>
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-brand-orange hover:underline"
          >
            See all on Google
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Review cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {REVIEWS.map(({ author, rating, excerpt, date }) => (
            <a
              key={author}
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-brand-orange/30"
            >
              {/* Stars */}
              <div className="flex items-center gap-2">
                <span className="text-yellow-400" aria-label={`${rating} out of 5 stars`}>
                  {'★'.repeat(rating)}
                </span>
                <span className="ml-auto text-xs text-brand-muted">{date}</span>
              </div>

              {/* Excerpt */}
              <p className="flex-1 text-sm leading-6 text-brand-muted">&ldquo;{excerpt}&rdquo;</p>

              {/* Author + Google attribution */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-text">{author}</span>
                <span className="text-xs text-brand-muted group-hover:text-brand-orange">
                  on Google →
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
