'use client';

import { usePathname } from 'next/navigation';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';
import { MobileCTABar } from './mobile-cta-bar';

/**
 * Renders SiteNav + SiteFooter + MobileCTABar only for non-admin routes.
 * Admin pages handle their own chrome via /admin/layout.tsx.
 * pb-20 on main ensures content isn't hidden behind the fixed mobile bar.
 */
export function ConditionalSiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteNav />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <SiteFooter />
      <MobileCTABar />
    </>
  );
}
