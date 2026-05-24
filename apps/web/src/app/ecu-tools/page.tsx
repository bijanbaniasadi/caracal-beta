import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ECU Tools & Workshop Services',
  description:
    'Professional ECU remapping, DPF off, EGR delete, AdBlue off, IMMO services, and file services for workshops in Dubai and the GCC.',
};

// ─── Service sections data ────────────────────────────────────────────────────

const SERVICES = [
  {
    id: 'remapping',
    eyebrow: 'Performance',
    title: 'ECU Remapping & Stage Tuning',
    description: `Stage 1 and Stage 2 power upgrades for petrol and diesel engines. Our calibrations address injection timing, rail pressure, boost targets, torque limiters, and smoke control maps — with checksum correction and stock file archiving as standard.`,
    details: [
      'Stage 1 — optimised stock hardware (intercooler, exhaust stock)',
      'Stage 2 — hardware-modified platform (intake, downpipe, intercooler)',
      'Torque model and limiter correction',
      'Diesel smoke reduction and fuel economy maps',
      'Checksum correction and file validation',
    ],
    cta: { label: 'Request a remap quote', href: '/contact' },
  },
  {
    id: 'dpf',
    eyebrow: 'Emissions',
    title: 'DPF Off — Particulate Filter Delete',
    description: `Software-side DPF removal covering regeneration cycles, DPF pressure sensors, temperature management, and all associated DTCs. Each job is matched against our vehicle database before any modification is applied.`,
    details: [
      'DPF regeneration cycle disable',
      'Lambda / O2 sensor management correction',
      'DPF pressure differential sensor delete',
      'EGT sensor map adjustments',
      'Full DTC suppression for P24xx, P04xx codes',
    ],
    cta: { label: 'Request DPF service', href: '/contact' },
  },
  {
    id: 'egr',
    eyebrow: 'Emissions',
    title: 'EGR Delete — EGR Off Service',
    description: `EGR system deletion at the software level — closing the valve permanently via map edits, removing carbon buildup–related fault codes, and correcting air mass flow maps that reference EGR position feedback.`,
    details: [
      'EGR valve position map zeroing',
      'MAF / air mass correction post-delete',
      'EGR cooler bypass correction',
      'P0400–P0409 DTC suppression',
      'Available for petrol and diesel platforms',
    ],
    cta: { label: 'Request EGR service', href: '/contact' },
  },
  {
    id: 'adblue',
    eyebrow: 'Emissions',
    title: 'AdBlue Off — SCR System Delete',
    description: `AdBlue / SCR system emulation and software delete for Euro 6 diesel vehicles. We cover both the ECU-side delete and NOx sensor emulation approaches depending on platform and jurisdiction requirements.`,
    details: [
      'SCR catalyst bypass in ECU software',
      'NOx sensor emulation or delete',
      'AdBlue level / quality sensor suppression',
      'P207F, P20EE, P249D DTC removal',
      'Supported: Bosch EDC17, MD1, Delphi DCM, Siemens SID',
    ],
    cta: { label: 'Request AdBlue service', href: '/contact' },
  },
  {
    id: 'immo',
    eyebrow: 'Security',
    title: 'IMMO Off & Key Programming',
    description: `Immobiliser bypass, transponder programming, and pin code extraction across all major ECU families. We handle both online key learning procedures and bench-level EEPROM operations where OBD methods are not available.`,
    details: [
      'IMMO off (full bypass in ECU + instrument cluster)',
      'Key learning via OBD and bench methods',
      'Pin code extraction from ECU EEPROM',
      'Transponder and key blade programming',
      'Bosch, Siemens, Delphi, Magneti Marelli, Denso',
    ],
    cta: { label: 'Request IMMO service', href: '/contact' },
  },
  {
    id: 'files',
    eyebrow: 'File Service',
    title: 'ECU File Processing Service',
    description: `Send us your OBD or bench-read ECU file and receive a modified version back within the agreed turnaround. Services include stage tuning, emissions delete, checksum correction, and stock file archiving.`,
    details: [
      'File received via BIN upload form (up to 50 MB)',
      'Stage 1 / Stage 2 / custom calibration',
      'DPF, EGR, AdBlue, IMMO on any file',
      'Checksum correction before return',
      'Stock file archived for rollback availability',
    ],
    cta: { label: 'Upload an ECU file', href: '/contact?tab=upload' },
  },
];

const SUPPORTED_ECU = [
  'Bosch EDC15 / EDC16 / EDC17',
  'Bosch MD1 / MG1 / ME7 / ME9 / MED17',
  'Siemens SID201 / SID206 / SID803 / SID807',
  'Delphi DCM3.5 / DCM6.2 / DCM7.1A',
  'Magneti Marelli MM6LP / SW7.4',
  'Continental SID305 / SID310',
  'Denso, Marelli, Hitachi (select platforms)',
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EcuToolsPage() {
  return (
    <div className="min-h-screen bg-brand-bg">

      {/* Hero banner */}
      <div className="relative overflow-hidden border-b border-white/10 bg-brand-deep">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-orange/5 to-transparent" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-3 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
                Workshop Services
              </p>
              <h1 className="font-display text-4xl font-bold text-brand-text sm:text-5xl">
                ECU Tools &amp; Technical Services
              </h1>
              <p className="mt-4 max-w-lg text-brand-muted">
                Professional-grade ECU programming and file services for Dubai workshops,
                fleet operators, and regional tuners. Every modification is compatibility-checked
                against our live vehicle database before being applied.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Request a Service
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold text-brand-text hover:bg-white/5 transition-colors"
                >
                  Browse Hardware
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Image
                src="/images/diagnostic-bench.png"
                alt="Caracal Tech diagnostic bench setup"
                width={560}
                height={380}
                className="rounded-xl object-cover shadow-brand"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-16">

        {/* Service sections */}
        {SERVICES.map(({ id, eyebrow, title, description, details, cta }) => (
          <section key={id} id={id} className="scroll-mt-20">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
                  {eyebrow}
                </p>
                <h2 className="font-display text-2xl font-bold text-brand-text sm:text-3xl">
                  {title}
                </h2>
                <p className="mt-4 leading-relaxed text-brand-muted">{description}</p>
                <Link
                  href={cta.href}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  {cta.label}
                </Link>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="mb-4 font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange/70">
                  What&apos;s included
                </p>
                <ul className="space-y-3">
                  {details.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-brand-muted">
                      <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-green">
                        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-12 h-px bg-white/10" />
          </section>
        ))}

        {/* Supported ECU families */}
        <section id="supported-ecu">
          <div className="mb-6">
            <p className="mb-2 font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
              Compatibility
            </p>
            <h2 className="font-display text-2xl font-bold text-brand-text">
              Supported ECU Families
            </h2>
            <p className="mt-2 text-brand-muted">
              Our service coverage is regularly updated alongside device protocol releases.
              Contact us if your ECU is not listed — we add new platforms frequently.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_ECU.map((ecu) => (
              <div
                key={ecu}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-green" aria-hidden="true" />
                <span className="font-technical text-sm font-medium text-brand-text">{ecu}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="rounded-xl border border-white/10 bg-brand-deep p-8 text-center">
          <h2 className="font-display text-xl font-bold text-brand-text">
            Not sure which service you need?
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            Message us on WhatsApp or submit a quote request and our technical team will
            assess your vehicle and recommend the correct approach.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a
              href="https://wa.me/971585796760"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Chat on WhatsApp
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-brand-text hover:bg-white/5 transition-colors"
            >
              Submit a Quote Request
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
