'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAdminAuth } from '@/contexts/admin-auth';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { AdminHeader } from '@/components/admin/layout/admin-header';

export function AdminLayoutShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isLoginPage) {
      router.replace('/admin/login');
    }
    if (isAuthenticated && isLoginPage) {
      router.replace('/admin/dashboard');
    }
  }, [isAuthenticated, isLoading, isLoginPage, router]);

  // Login page — no chrome
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-[#071015] text-brand-text">
        {children}
      </div>
    );
  }

  // Not yet checked auth — blank while redirecting
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071015]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
      </div>
    );
  }

  // Full admin shell
  return (
    <div className="flex h-screen overflow-hidden bg-[#071015] text-brand-text">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
