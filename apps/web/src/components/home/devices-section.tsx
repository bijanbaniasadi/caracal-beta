import Image from 'next/image';
import Link from 'next/link';

const DEVICES = [
  {
    name: 'KESS3',
    subtitle: 'Master / Slave',
    description:
      'The industry benchmark for OBD and bench ECU programming. Full boot and BDM support with regular protocol updates via the Alientech ecosystem.',
    image: '/images/devices/kess3.png',
    slug: 'kess3-master',
  },
  {
    name: 'AutoTuner',
    subtitle: 'OBD & Bench Tool',
    description:
      'A versatile multi-protocol tuning interface covering a wide range of OBD-accessible and bench ECUs. Strong diesel and petrol coverage.',
    image: '/images/devices/autotuner.png',
    slug: 'autotuner',
  },
  {
    name: 'BFlash',
    subtitle: 'Flash Interface',
    description:
      'High-speed bench flashing hardware designed for reliable ECU read/write cycles. Compact, rugged, and built for workshop throughput.',
    image: '/images/devices/bflash.png',
    slug: 'bflash',
  },
];

export function DevicesSection() {
  return (
    <section className="border-t border-white/10 bg-brand-deep py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
              Supported hardware
            </p>
            <h2 className="font-display text-3xl font-bold text-brand-text sm:text-4xl">
              Professional ECU Interfaces
            </h2>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange hover:underline"
          >
            Browse all products
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Device cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {DEVICES.map(({ name, subtitle, description, image, slug }) => (
            <Link
              key={name}
              href={`/shop/${slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-colors hover:border-brand-orange/30"
            >
              {/* Image */}
              <div className="flex items-center justify-center bg-brand-bg p-8">
                <Image
                  src={image}
                  alt={`${name} ECU programming device`}
                  width={220}
                  height={180}
                  className="h-44 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Info */}
              <div className="flex flex-col gap-2 p-5">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-lg font-bold text-brand-text">{name}</h3>
                  <span className="font-technical text-xs font-medium uppercase tracking-wide text-brand-orange/70">
                    {subtitle}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-brand-muted">{description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-orange">
                  View in shop
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
