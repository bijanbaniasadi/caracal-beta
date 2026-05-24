import Link from 'next/link';
import Image from 'next/image';

const SERVICES = [
  { label: 'ECU Remapping', href: '/ecu-tools' },
  { label: 'DPF Off Service', href: '/ecu-tools#dpf' },
  { label: 'EGR Delete', href: '/ecu-tools#egr' },
  { label: 'AdBlue Off', href: '/ecu-tools#adblue' },
  { label: 'IMMO Services', href: '/ecu-tools#immo' },
  { label: 'File Services', href: '/ecu-tools#files' },
];

const KNOWLEDGE = [
  { label: 'What is ECU Tuning?', href: '/articles' },
  { label: 'KESS3 Guide', href: '/articles' },
  { label: 'WinOLS Tutorial', href: '/articles' },
  { label: 'DPF Off Guide', href: '/articles' },
  { label: 'Knowledge Base', href: '/articles' },
];

const COMPANY = [
  { label: 'Shop', href: '/shop' },
  { label: 'Get a Quote', href: '/contact' },
  { label: 'Workshop Consultation', href: '/contact' },
  { label: 'Product Inquiry', href: '/contact' },
];

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
              Professional ECU tuning tools, diagnostic equipment, and technical
              workshop support. Based in Deira, Dubai, UAE.
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

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-brand-muted">
            &copy; {new Date().getFullYear()} Caracaltech Motors LLC. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-brand-muted">
            <Link href="/privacy" className="hover:text-brand-text transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-brand-text transition-colors">Terms</Link>
            <Link href="/shipping" className="hover:text-brand-text transition-colors">Shipping</Link>
            <Link href="/refund" className="hover:text-brand-text transition-colors">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
