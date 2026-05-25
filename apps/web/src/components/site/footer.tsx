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
            <div className="mt-4 space-y-1 text-xs text-brand-muted">
              <p>+971 585 796 760</p>
              <p>info@caracaltechmotors.com</p>
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

        <div className="mt-10 grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-brand-text">Google review trust</p>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              5.0 rating from 14 public Google reviews. Customers mention fast technical support
              and workshop-ready help in Dubai.
            </p>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-xs font-semibold text-brand-orange hover:underline"
            >
              View all reviews on Google
            </a>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text">UAE shipping</p>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              Dubai-based fulfilment, UAE courier delivery, and free shipping eligibility on larger
              hardware orders.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text">Warranty and compatibility</p>
            <p className="mt-2 text-xs leading-5 text-brand-muted">
              Supplier warranty, stock status, ECU protocol coverage, and workshop compatibility can
              be confirmed before dispatch.
            </p>
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
