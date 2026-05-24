'use client';

import { usePathname } from 'next/navigation';
import { SiteNav } from './nav';
import { SiteFooter } from './footer';

/**
 * Renders SiteNav + SiteFooter only for non-admin routes.
 * Admin pages handle their own chrome via /admin/layout.tsx.
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
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
