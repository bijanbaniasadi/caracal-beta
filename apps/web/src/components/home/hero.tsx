import Image from 'next/image';
import Link from 'next/link';

const QUICK_LINKS = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      </svg>
    ),
    title: 'ECU Remapping',
    text: 'Stage 1 & 2, DPF, EGR, AdBlue',
    href: '/ecu-remapping-dubai',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    title: 'Shop Tools',
    text: 'KESS3, AutoTuner, BFlash',
    href: '/shop',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Knowledge Base',
    text: '80+ technical articles',
    href: '/knowledge',
  },
];

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Caracaltech+Motors+LLC/@25.2645178,55.3325059,17.55z/data=!4m6!3m5!1s0x3e5f5db936da9f23:0x2f4212cc1172b758!8m2!3d25.26373!4d55.333424!16s%2Fg%2F11yt004nkq';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-bg">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-orange/5 via-transparent to-transparent" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8 lg:items-center">

          {/* ── Copy ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-brand-orange" />
              <span className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
                ECU Technical Solutions
              </span>
            </div>

            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-brand-text sm:text-5xl lg:text-6xl">
              Professional ECU{' '}
              <span className="text-brand-orange">Tuning Tools</span>
              <br />
              &amp; Workshop Support
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-brand-muted sm:text-lg">
              Caracal Tech Motors supplies professional-grade ECU programming
              hardware, file services, and technical support for workshops and
              fleet operators across the UAE and GCC.
            </p>

            {/* Quick links grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {QUICK_LINKS.map(({ icon, title, text, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-brand-orange/40 hover:bg-brand-orange/5"
                >
                  <span className="text-brand-orange">{icon}</span>
                  <strong className="text-sm font-semibold text-brand-text">{title}</strong>
                  <span className="text-xs text-brand-muted">{text}</span>
                </Link>
              ))}
            </div>

            {/* CTA row */}
            <div className="flex flex-wrap gap-3">
              <a
                href="https://wa.me/971585796760?text=Hi%2C%20I%27d%20like%20a%20quote%20for%20ECU%20tuning"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                <WhatsAppIcon />
                Get a WhatsApp Quote
              </a>
              <Link
                href="/ecu-tools"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text transition-colors hover:border-white/40 hover:bg-white/5"
              >
                View Workshop Services
                <ArrowRight />
              </Link>
            </div>
          </div>

          {/* ── Visual panel ──────────────────────────────────────────────── */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-brand shadow-brand">
              <Image
                src="/images/hero-workshop.png"
                alt="Caracal Tech workshop bench with ECU hardware"
                width={720}
                height={540}
                className="h-auto w-full object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              {/* Overlay gradient at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brand-bg/80 to-transparent" aria-hidden="true" />

              {/* Brand badge */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="rounded-lg border border-white/15 bg-black/60 px-4 py-3 backdrop-blur-sm">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-brand-orange">
                    Caracal Tech Motors
                  </p>
                  <p className="text-xs text-brand-muted">Workshop Technical Support · Deira, Dubai</p>
                </div>
              </div>

              {/* Device chips */}
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                {['KESS3', 'AutoTuner', 'BFlash'].map((device) => (
                  <span
                    key={device}
                    className="rounded-full border border-brand-orange/40 bg-brand-bg/80 px-3 py-1 font-technical text-xs font-semibold text-brand-orange backdrop-blur-sm"
                  >
                    {device}
                  </span>
                ))}
              </div>
            </div>

            {/* Trust strip below image */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {/* Google Rating — clickable */}
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center transition-colors hover:border-brand-orange/30"
              >
                <p className="font-technical text-sm font-bold text-brand-orange group-hover:underline">
                  ★★★★★ 5.0
                </p>
                <p className="text-xs text-brand-muted">14 Google Reviews</p>
              </a>
              {/* Location */}
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=25.26373,55.333424&travelmode=driving"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center transition-colors hover:border-brand-orange/30"
              >
                <p className="font-technical text-sm font-bold text-brand-text">Deira, Dubai</p>
                <p className="text-xs text-brand-muted">Get Directions</p>
              </a>
              {/* Workflow */}
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center">
                <p className="font-technical text-sm font-bold text-brand-text">ECU · IMMO</p>
                <p className="text-xs text-brand-muted">Files · Flashing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
