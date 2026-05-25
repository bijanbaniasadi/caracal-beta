'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCustomerAuth } from '@/contexts/customer-auth';

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchExact?: boolean;
}

function IconDashboard() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".6" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".6" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity=".4" />
    </svg>
  );
}

function IconOrders() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 2h11l-1.5 8.5H3.5L2 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="5" cy="13" r="1" fill="currentColor" />
      <circle cx="10" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function IconInquiries() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h8A1.5 1.5 0 0 1 13 2.5v7A1.5 1.5 0 0 1 11.5 11H9l-1.5 3L6 11H3.5A1.5 1.5 0 0 1 2 9.5v-7Z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function IconUploads() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1v9M4 4l3.5-3L11 4M2.5 11.5v1A1 1 0 0 0 3.5 13.5h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9l1.06 1.06M11.04 11.04l1.06 1.06M2.9 12.1l1.06-1.06M11.04 3.96l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: '/account',           label: 'Overview',   icon: <IconDashboard />, matchExact: true },
  { href: '/account/orders',    label: 'Orders',     icon: <IconOrders /> },
  { href: '/account/inquiries', label: 'Inquiries',  icon: <IconInquiries /> },
  { href: '/account/uploads',   label: 'ECU Files',  icon: <IconUploads /> },
  { href: '/account/settings',  label: 'Settings',   icon: <IconSettings /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountSidebar() {
  const pathname = usePathname();
  const { session, logout } = useCustomerAuth();

  const initials = session?.user.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : session?.user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <aside className="flex h-full w-56 flex-col border-r border-white/10 bg-[#0a1520]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange/20">
          <span className="font-display text-sm font-bold text-brand-orange">C</span>
        </div>
        <div>
          <p className="font-display text-xs font-bold leading-none text-brand-text">Caracal</p>
          <p className="text-[10px] font-medium text-brand-muted">Dealer Portal</p>
        </div>
      </div>

      {/* User card */}
      <div className="border-b border-white/5 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/20 text-[11px] font-bold text-brand-orange">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-brand-text">
              {session?.user.name ?? session?.user.email ?? '—'}
            </p>
            <p className="truncate text-[10px] text-brand-muted">
              {session?.user.name ? session.user.email : 'Customer Account'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Account navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon, matchExact }) => {
            const active = matchExact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-orange/15 text-brand-orange'
                      : 'text-brand-muted hover:bg-white/5 hover:text-brand-text',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="shrink-0">{icon}</span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Quick links */}
        <div className="mt-4 border-t border-white/5 pt-4">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-muted/50">
            Quick actions
          </p>
          <a
            href="https://wa.me/971585796760?text=Hi%2C+I+need+support+with+my+account"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text"
          >
            <span className="shrink-0 text-[13px]">💬</span>
            WhatsApp Support
          </a>
          <Link
            href="/shop"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-brand-text"
          >
            <span className="shrink-0 text-[13px]">🛒</span>
            Browse Shop
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <button
          type="button"
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-red-400"
        >
          ⏏ Sign out
        </button>
      </div>
    </aside>
  );
}
