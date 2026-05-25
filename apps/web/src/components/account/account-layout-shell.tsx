'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useCustomerAuth } from '@/contexts/customer-auth';

const accountLinks = [
  { href: '/account', label: 'Overview' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/inquiries', label: 'Inquiries' },
  { href: '/account/uploads', label: 'Uploads' },
  { href: '/account/settings', label: 'Settings' },
];

export function AccountLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, isLoading, logout } = useCustomerAuth();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, pathname, router, session]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
      </div>
    );
  }

  const companyLabel =
    session.user.companyName ?? session.user.workshopName ?? session.user.name ?? 'Account';

  return (
    <section className="bg-brand-bg">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-technical text-sm font-semibold uppercase tracking-widest text-brand-orange">
              Customer workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-brand-text">{companyLabel}</h1>
            <p className="mt-1 text-sm text-brand-muted">{session.user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => router.push('/login'));
            }}
            className="w-fit rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {accountLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-brand-orange text-white'
                      : 'border border-white/10 bg-white/5 text-brand-muted hover:text-brand-text',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </section>
  );
}
