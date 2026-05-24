import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/providers';
import { SiteNav } from '@/components/site/nav';
import { SiteFooter } from '@/components/site/footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Caracal Tech Motors — ECU Tuning Tools & Workshop Support Dubai',
    template: '%s | Caracal Tech',
  },
  description:
    'Professional ECU tuning tools, diagnostic equipment, and workshop technical support in Dubai. KESS3, AutoTuner, BFlash, DPF off, EGR delete and more.',
  metadataBase: new URL('https://caracaltechmotors.com'),
  openGraph: {
    siteName: 'Caracal Tech Motors',
    locale: 'en_AE',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-brand-bg text-brand-text">
        <Providers>
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
