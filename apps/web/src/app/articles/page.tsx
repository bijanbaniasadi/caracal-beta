import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Knowledge Base — ECU Tuning Articles & Guides',
  description:
    'In-depth technical articles on ECU tuning, DPF off, EGR delete, IMMO services, KESS3, AutoTuner, WinOLS, and more. Written for workshops and professional tuners.',
};

// ─── Article data ─────────────────────────────────────────────────────────────

type ArticleCategory = 'Fundamentals' | 'Hardware' | 'Services' | 'Software' | 'Technical' | 'Business' | 'Vehicle-Specific';

interface Article {
  slug: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  cover: string;
}

const ARTICLES: Article[] = [
  // Fundamentals
  {
    slug: 'what-is-ecu-tuning',
    title: 'What is ECU Tuning?',
    summary: 'A complete introduction to ECU remapping — what the ECU controls, how tuning files modify its parameters, and what results are realistic on a stock engine.',
    category: 'Fundamentals',
    cover: '/images/articles/what-is-ecu-tuning.png',
  },
  {
    slug: 'what-is-ecu-remapping',
    title: 'What is ECU Remapping?',
    summary: 'The difference between remapping and chip tuning, how modern flash-based ECUs work, and the correct process for a safe remap.',
    category: 'Fundamentals',
    cover: '/images/articles/what-is-ecu-remapping.png',
  },
  {
    slug: 'how-to-chiptuning',
    title: 'How to Chip-tune Your Car with a Laptop',
    summary: 'A beginner-friendly walkthrough of the tools, software, and steps needed to tune an ECU from a laptop — covering OBD and bench approaches.',
    category: 'Fundamentals',
    cover: '/images/articles/how-to-chiptuning-your-car-with-laptop.png',
  },
  // Hardware
  {
    slug: 'what-is-kess3',
    title: 'KESS3 — Full Device Guide',
    summary: 'Everything you need to know about the KESS3 interface: OBD coverage, bench protocols, boot modes, Alientech subscription tiers, and Master vs Slave.',
    category: 'Hardware',
    cover: '/images/articles/what-is-kess3.png',
  },
  {
    slug: 'kess-v2-clone-vs-original',
    title: 'KESS V2: Clone vs Original',
    summary: 'Why clone KESS V2 units fail in production, how to identify counterfeits, and what the technical risks are when using non-genuine hardware.',
    category: 'Hardware',
    cover: '/images/articles/kess-v2-clone-vs-original.png',
  },
  // Services
  {
    slug: 'dpf-off-service',
    title: 'DPF Off Service — The Complete Guide',
    summary: 'How DPF removal works at the software level, what ECU parameters are involved, pre-checks you must perform, and the diagnostic process before a delete.',
    category: 'Services',
    cover: '/images/articles/dpf-off-service-dpf-off-solution.png',
  },
  {
    slug: 'egr-delete-service',
    title: 'EGR Delete — EGR Off Service Guide',
    summary: 'The EGR system explained: why workshops delete it, how it is done in software, and the map sets that need correcting after an EGR off.',
    category: 'Services',
    cover: '/images/articles/egr-delete-egr-off-service.png',
  },
  {
    slug: 'adblue-off-service',
    title: 'AdBlue Off — Disable the AdBlue System',
    summary: 'AdBlue / SCR emulation explained: the module approach vs. ECU-side software delete, and the compatibility matrix for common Euro 6 platforms.',
    category: 'Services',
    cover: '/images/articles/adblue-off-service-disable-the-adblue-system.png',
  },
  {
    slug: 'original-ecu-files-database',
    title: 'Original ECU Files Database — Download Guide',
    summary: 'How to source original (stock) ECU files for comparison and safety rollback. Which databases are trusted, and how to verify file integrity before use.',
    category: 'Services',
    cover: '/images/articles/original-ecu-files-database-download.png',
  },
  // Software
  {
    slug: 'winols-tutorial',
    title: 'WinOLS Tutorial Course',
    summary: 'A structured path through WinOLS: project setup, map search and identification, version management, and submitting files to a slave network.',
    category: 'Software',
    cover: '/images/articles/winols-tutorial-course.png',
  },
  {
    slug: 'ecm-titanium-tutorial',
    title: 'ECM Titanium — Tutorial & Setup Guide',
    summary: 'Getting started with ECM Titanium: driver installation, map identification, and using the built-in driver database for quick parameter access.',
    category: 'Software',
    cover: '/images/articles/ecm-titanium-tutorial.png',
  },
  // Technical
  {
    slug: 'edc-tuning-guide',
    title: 'EDC15 / EDC16 / EDC17 Tuning Guide',
    summary: 'A deep dive into the Bosch EDC family — architecture differences, injection and boost maps, torque limiters, and the parameter sets most modified in stage tuning.',
    category: 'Technical',
    cover: '/images/articles/edc-15-16-17-tuning-guide.png',
  },
  {
    slug: 'turbocharger-tables',
    title: 'Turbocharger Tables in ECU Tuning',
    summary: 'How boost pressure, wastegate duty cycle, and VNT maps interact in a diesel ECU. What to touch, what to leave alone, and how to read compressor maps.',
    category: 'Technical',
    cover: '/images/articles/turbocharger-tables.png',
  },
  // Business
  {
    slug: 'ecu-tuning-business',
    title: 'How to Start an ECU Tuning Business',
    summary: 'The hardware, software, and business structure you need to set up a profitable ECU tuning operation — from slave file sourcing to workshop client acquisition.',
    category: 'Business',
    cover: '/images/articles/how-to-have-your-own-ecu-tuning-business.png',
  },
  // Vehicle-specific
  {
    slug: 'bmw-x5-o2-sensor',
    title: 'BMW X5 E53 — Downstream O2 Sensor Delete',
    summary: 'Step-by-step guide to removing rear O2 sensor error codes on the BMW E53 X5, covering map locations and DTC suppression in the DME.',
    category: 'Vehicle-Specific',
    cover: '/images/articles/bmw-x5-e53-downstream-o2-sensor-delete.png',
  },
  {
    slug: 'subaru-street-tuning',
    title: 'Subaru Street Tuning — Fuel, Timing & Boost',
    summary: 'A discipline-first guide to tuning the Subaru EJ and FA platforms: AFR targets, ignition advance, boost control, and validation on a load-bearing dyno.',
    category: 'Vehicle-Specific',
    cover: '/images/articles/subaru-street-tuning-workflow-fuel-timing-and-boost-discipline.png',
  },
];

const CATEGORIES: ArticleCategory[] = [
  'Fundamentals', 'Hardware', 'Services', 'Software', 'Technical', 'Business', 'Vehicle-Specific',
];

const CATEGORY_COLOR: Record<ArticleCategory, string> = {
  Fundamentals: 'text-brand-green',
  Hardware: 'text-sky-400',
  Services: 'text-brand-orange',
  Software: 'text-violet-400',
  Technical: 'text-amber-400',
  Business: 'text-brand-orange-soft',
  'Vehicle-Specific': 'text-rose-400',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArticlesPage() {
  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    articles: ARTICLES.filter((a) => a.category === cat),
  })).filter((g) => g.articles.length > 0);

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Page header */}
      <div className="border-b border-white/10 bg-brand-deep px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
            Knowledge Base
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">
            ECU Tuning Technical Library
          </h1>
          <p className="mt-3 max-w-2xl text-brand-muted">
            80+ in-depth articles on ECU tuning, diagnostics, emissions services, tuning software,
            and workshop operations. Written for professional tuners and workshop technicians.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
        {grouped.map(({ category, articles }) => (
          <section key={category} id={category.toLowerCase().replace(/[^a-z]/g, '-')}>
            {/* Category header */}
            <div className="mb-6 flex items-center gap-4">
              <h2 className={`font-display text-xl font-bold ${CATEGORY_COLOR[category]}`}>
                {category}
              </h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* Article grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {articles.map(({ slug, title, summary, cover, category: cat }) => (
                <article
                  key={slug}
                  id={slug}
                  className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-brand-orange/30"
                >
                  {/* Cover */}
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
                    <span className={`font-technical text-xs font-semibold uppercase tracking-wider ${CATEGORY_COLOR[cat]}`}>
                      {cat}
                    </span>
                    <h3 className="font-display text-sm font-bold text-brand-text leading-snug group-hover:text-brand-orange transition-colors">
                      {title}
                    </h3>
                    <p className="flex-1 text-xs leading-relaxed text-brand-muted line-clamp-4">
                      {summary}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Bottom CTA */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="font-display text-lg font-bold text-brand-text">
            Need technical support beyond these articles?
          </p>
          <p className="mt-2 text-sm text-brand-muted">
            Our team is available for direct workshop consultations and file services.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href="https://wa.me/971585796760"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Chat on WhatsApp
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-white/5 transition-colors"
            >
              Workshop Consultation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
