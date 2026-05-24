'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/products':  'Products',
  '/admin/inventory': 'Inventory',
  '/admin/articles':  'Articles',
  '/admin/inquiries': 'Inquiries',
  '/admin/uploads':   'Uploads',
};

interface AdminHeaderProps {
  action?: React.ReactNode;
}

export function AdminHeader({ action }: AdminHeaderProps) {
  const pathname = usePathname();

  // Match the most specific prefix
  const title =
    Object.entries(TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([key]) => pathname.startsWith(key))?.[1] ?? 'Admin';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0b1218]/80 px-6 backdrop-blur-sm">
      <h1 className="font-display text-base font-bold text-brand-text">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        {action}
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:border-white/20 hover:text-brand-text"
        >
          <span aria-hidden="true">↗</span> View site
        </Link>
      </div>
    </header>
  );
}
