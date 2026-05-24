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
  { href: '/admin/inventory',       label: 'Inventory',      icon: '🗃' },
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
    <aside className="flex h-full w-56 flex-col border-r border-white/10 bg-[#0b1218]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange/20">
          <span className="text-sm font-bold text-brand-orange">C</span>
        </div>
        <div>
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
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-orange/15 text-brand-orange'
                      : 'text-brand-muted hover:bg-white/5 hover:text-brand-text',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {icon}
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="mb-2 rounded-lg bg-white/[0.04] px-3 py-2">
          <p className="truncate text-xs font-medium text-brand-text">
            {session?.user.email ?? '—'}
          </p>
          <p className="text-[10px] text-brand-muted">{session?.user.role ?? ''}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-brand-muted transition-colors hover:bg-white/5 hover:text-red-400"
        >
          ⏏ Sign out
        </button>
      </div>
    </aside>
  );
}
