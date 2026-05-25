'use client';

import Link from 'next/link';

/**
 * MobileCTABar
 * Fixed bottom bar visible only on mobile/tablet (hidden md:hidden).
 * Three taps: WhatsApp (primary), Shop, Call.
 * Sits above the browser chrome; uses safe-area inset for notched devices.
 */
export function MobileCTABar() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex md:hidden border-t border-white/10 bg-brand-bg/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Quick actions"
    >
      {/* WhatsApp — primary action, full orange */}
      <a
        href="https://wa.me/971585796760?text=Hi%2C%20I%20need%20workshop%20support"
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col items-center justify-center gap-1 bg-brand-orange py-3 text-white active:opacity-80"
        aria-label="Chat on WhatsApp"
      >
        <WhatsAppIcon />
        <span className="text-[10px] font-semibold leading-none">WhatsApp</span>
      </a>

      {/* Divider */}
      <div className="w-px bg-white/10" />

      {/* Shop */}
      <Link
        href="/shop"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-brand-muted active:bg-white/5 active:text-brand-text"
        aria-label="Browse Shop"
      >
        <ShopIcon />
        <span className="text-[10px] font-semibold leading-none">Shop</span>
      </Link>

      {/* Divider */}
      <div className="w-px bg-white/10" />

      {/* Call */}
      <a
        href="tel:+971585796760"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-3 text-brand-muted active:bg-white/5 active:text-brand-text"
        aria-label="Call 058 579 6760"
      >
        <PhoneIcon />
        <span className="text-[10px] font-semibold leading-none">Call</span>
      </a>
    </nav>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}
