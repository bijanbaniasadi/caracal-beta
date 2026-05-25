import Link from 'next/link';
import Image from 'next/image';

const SERVICES = [
  { label: 'ECU Remapping Dubai', href: '/ecu-remapping-dubai' },
  { label: 'ECU Tuning', href: '/ecu-tuning' },
  { label: 'DPF Off Service', href: '/immo-dpf-adblue-services' },
  { label: 'EGR Delete', href: '/immo-dpf-adblue-services' },
  { label: 'AdBlue Off', href: '/immo-dpf-adblue-services' },
  { label: 'IMMO Services', href: '/immo-dpf-adblue-services' },
  { label: 'File Services', href: '/ecu-tools#files' },
];

const KNOWLEDGE = [
  { label: 'What is ECU Tuning?', href: '/knowledge/what-is-ecu-tuning' },
  { label: 'KESS3 Guide', href: '/knowledge/what-is-kess3' },
  { label: 'WinOLS Tutorial', href: '/knowledge/winols-tutorial-course' },
  { label: 'DPF Off Guide', href: '/knowledge/dpf-off-service-dpf-off-solution' },
  { label: 'Knowledge Base', href: '/knowledge' },
];

const COMPANY = [
  { label: 'Shop', href: '/shop' },
  { label: 'Get a Quote', href: '/contact' },
  { label: 'Workshop Consultation', href: '/contact' },
  { label: 'Product Inquiry', href: '/contact' },
];

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Caracaltech+Motors+LLC/@25.2645178,55.3325059,17.55z/data=!4m6!3m5!1s0x3e5f5db936da9f23:0x2f4212cc1172b758!8m2!3d25.26373!4d55.333424!16s%2Fg%2F11yt004nkq';

function WhatsAppFooterIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-brand-deep">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/brand/logo.png"
                alt="Caracal Tech Motors"
                width={36}
                height={36}
                className="h-9 w-auto object-contain"
              />
              <span className="font-display text-sm font-semibold text-brand-text">
                Caracal Tech
              </span>
            </Link>
            <p className="mt-4 text-xs leading-relaxed text-brand-muted">
              Professional ECU tuning tools, diagnostic equipment, and technical workshop support.
              Based in Deira, Dubai, UAE.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-brand-muted">
              <a
                href="tel:+971585796760"
                className="block transition-colors hover:text-brand-text"
              >
                +971 585 796 760
              </a>
              <a
                href="https://wa.me/971585796760?text=Hi%2C%20I%20need%20workshop%20support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-brand-orange"
              >
                <WhatsAppFooterIcon />
                WhatsApp support
              </a>
              <a
                href="mailto:info@caracaltechmotors.com"
                className="block transition-colors hover:text-brand-text"
              >
                info@caracaltechmotors.com
              </a>
              <p>Office 117, Al Shaikh Building 05</p>
              <p>Deira, Dubai, UAE</p>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-orange">
              Services
            </h3>
            <ul className="space-y-2">
              {SERVICES.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-brand-muted transition-colors hover:text-brand-text"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Knowledge */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-orange">
              Knowledge
            </h3>
            <ul className="space-y-2">
              {KNOWLEDGE.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-brand-muted transition-colors hover:text-brand-text"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-orange">
              Company
            </h3>
            <ul className="space-y-2">
              {COMPANY.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-brand-muted transition-colors hover:text-brand-text"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust band */}
        <div className="mt-10 grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 md:grid-cols-3">
          {/* Google rating — real visual widget */}
          <div>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex flex-col gap-1"
            >
              <span className="text-xl tracking-tight text-yellow-400 group-hover:underline">
                ★★★★★
              </span>
              <span className="text-sm font-bold text-brand-text">
                5.0 — 14 verified Google reviews
              </span>
            </a>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              Workshops and technicians across UAE and GCC mention accurate compatibility
              checks, fast file turnaround, and direct technical support.
            </p>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-orange hover:underline"
            >
              Read all reviews on Google →
            </a>
          </div>

          {/* WhatsApp + contact */}
          <div>
            <p className="text-sm font-semibold text-brand-text">WhatsApp workshop support</p>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              File requests, compatibility questions, and hardware orders answered same day during
              UAE business hours (Sun–Thu, 9AM–6PM).
            </p>
            <a
              href="https://wa.me/971585796760?text=Hi%2C%20I%20need%20workshop%20support"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-orange hover:underline"
            >
              <WhatsAppFooterIcon />
              058 579 6760
            </a>
          </div>

          {/* Shipping + warranty */}
          <div>
            <p className="text-sm font-semibold text-brand-text">UAE shipping &amp; warranty</p>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              AED 25 flat shipping · Free over AED 500 · Dubai/Sharjah same-day or next-day ·
              14-day hardware return · Custom tuning file revisions free of charge.
            </p>
            <Link
              href="/shipping"
              className="mt-2 inline-flex text-xs font-semibold text-brand-orange hover:underline"
            >
              Shipping policy →
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-brand-muted">
            &copy; {new Date().getFullYear()} Caracaltech Motors LLC. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-brand-muted">
            <Link href="/privacy" className="hover:text-brand-text transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-brand-text transition-colors">
              Terms
            </Link>
            <Link href="/shipping" className="hover:text-brand-text transition-colors">
              Shipping
            </Link>
            <Link href="/refund" className="hover:text-brand-text transition-colors">
              Refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
