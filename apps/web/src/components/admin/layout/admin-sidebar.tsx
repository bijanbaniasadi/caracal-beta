'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/contexts/admin-auth';

// ─── Nav items ────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: string;
  matchExact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard',       label: 'Dashboard',      icon: '▦', matchExact: true },
  { href: '/admin/products',        label: 'Products',       icon: '📦' },
  { href: '/admin/catalog/review',  label: 'Catalog Ops',    icon: 'C' },
  { href: '/admin/catalog/sync',    label: 'Catalog Sync',   icon: 'S' },
  { href: '/admin/inventory',       label: 'Inventory',      icon: '🗃' },
  { href: '/admin/orders',          label: 'Orders',         icon: '$' },
  { href: '/admin/articles',        label: 'Articles',       icon: '📝' },
  { href: '/admin/inquiries',       label: 'Inquiries',      icon: '💬' },
  { href: '/admin/uploads',         label: 'Uploads',        icon: '📂' },
  { href: '/admin/bin-processing',  label: 'BIN Jobs',       icon: '🔬' },
  { href: '/admin/queues',          label: 'Queues',         icon: '⚡' },
  { href: '/admin/corpus',          label: 'ECU Corpus',     icon: '🧬' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const pathname = usePathname();
  const { session, logout } = useAdminAuth();

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-white/10 bg-[#0b1218] sm:w-56">
      {/* Brand */}
      <div className="flex items-center justify-center gap-2.5 border-b border-white/10 px-2 py-4 sm:justify-start sm:px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange/20">
          <span className="text-sm font-bold text-brand-orange">C</span>
        </div>
        <div className="hidden sm:block">
          <p className="font-display text-xs font-bold text-brand-text leading-none">Caracal</p>
          <p className="text-[10px] font-medium text-brand-muted">Admin Panel</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon, matchExact }) => {
            const active = matchExact
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    'flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:justify-start',
                    active
                      ? 'bg-brand-orange/15 text-brand-orange'
                      : 'text-brand-muted hover:bg-white/5 hover:text-brand-text',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                  title={label}
                >
                  <span className="text-base leading-none sm:w-4" aria-hidden="true">
                    {icon}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-2 py-3 sm:px-3">
        <div className="mb-2 hidden rounded-lg bg-white/[0.04] px-3 py-2 sm:block">
          <p className="truncate text-xs font-medium text-brand-text">
            {session?.user.email ?? '—'}
          </p>
          <p className="text-[10px] text-brand-muted">{session?.user.role ?? ''}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          title="Sign out"
          className="w-full rounded-lg px-2 py-2 text-center text-xs font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-red-400 sm:px-3 sm:text-left"
        >
          <span aria-hidden="true">⏏</span>
          <span className="hidden sm:inline"> Sign out</span>
        </button>
      </div>
    </aside>
  );
}
