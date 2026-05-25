import Link from 'next/link';

const SERVICES = [
  {
    eyebrow: 'Performance',
    title: 'ECU Remapping & Stage Tuning',
    text: 'Stage 1, Stage 2, and custom power maps for petrol and diesel engines. Torque model correction, boost pressure optimisation, and injection timing.',
    href: '/ecu-remapping-dubai',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    eyebrow: 'Emissions',
    title: 'DPF · EGR · AdBlue Services',
    text: 'Professional off-cycle services for DPF, EGR, and AdBlue systems. Compatibility-checked against real vehicle data before any modification is applied.',
    href: '/immo-dpf-adblue-services',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    eyebrow: 'Security',
    title: 'IMMO Off & Key Programming',
    text: 'Immobiliser bypass, key learning, pin extraction, and transponder services. Supported across all major ECU families including Bosch, Siemens, Delphi, and Magneti Marelli.',
    href: '/immo-dpf-adblue-services',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    eyebrow: 'Files',
    title: 'ECU File & Tuning File Service',
    text: 'Receive, process, and return ECU files with corrections applied. Slave file handling, checksum correction, and database-backed compatibility verification.',
    href: '/ecu-tuning',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="border-t border-white/10 bg-brand-bg py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-12 max-w-2xl">
          <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
            What we do
          </p>
          <h2 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">
            Technical Services for Workshops and Fleets
          </h2>
          <p className="mt-4 text-brand-muted">
            Every service is backed by a live vehicle compatibility database covering
            thousands of ECU variants across the GCC and Europe.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ eyebrow, title, text, href, icon }) => (
            <article
              key={title}
              className="group relative flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-brand-orange/30 hover:bg-brand-orange/5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-brand-orange">
                {icon}
              </span>

              <div>
                <p className="mb-1 font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/70">
                  {eyebrow}
                </p>
                <h3 className="font-display text-base font-bold text-brand-text leading-snug">
                  {title}
                </h3>
              </div>

              <p className="flex-1 text-sm leading-relaxed text-brand-muted">{text}</p>

              <Link
                href={href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange transition-gap hover:gap-2.5"
              >
                Learn more
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
