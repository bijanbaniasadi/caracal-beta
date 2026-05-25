'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/contexts/customer-auth';
import { AccountSidebar } from './account-sidebar';

// ─── Shell ─────────────────────────────────────────────────────────────────────

export function AccountShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Auth check in progress — show spinner
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071015]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
          <p className="text-sm text-brand-muted">Loading your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#071015] text-brand-text">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <AccountSidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <MobileAccountBar />

        <main className="flex-1 overflow-y-auto p-5 md:p-6" key={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Mobile top bar (replaces sidebar on sm) ──────────────────────────────────

function MobileAccountBar() {
  const pathname = usePathname();
  const { logout } = useCustomerAuth();

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-[#0a1520] px-4 py-3 md:hidden">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-orange/20">
          <span className="font-display text-xs font-bold text-brand-orange">C</span>
        </div>
        <span className="font-display text-sm font-bold text-brand-text">Dealer Portal</span>
      </div>

      {/* Quick nav pills */}
      <MobileNav pathname={pathname} />

      {/* Sign out */}
      <button
        type="button"
        onClick={logout}
        className="rounded-lg p-1.5 text-xs text-brand-muted hover:text-red-400"
        aria-label="Sign out"
      >
        ⏏
      </button>
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const items = [
    { href: '/account', label: 'Home', exact: true },
    { href: '/account/orders', label: 'Orders', exact: false },
    { href: '/account/uploads', label: 'Files', exact: false },
  ];

  return (
    <nav className="flex gap-1" aria-label="Mobile account nav">
      {items.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            className={[
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-brand-orange/15 text-brand-orange'
                : 'text-brand-muted hover:text-brand-text',
            ].join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
