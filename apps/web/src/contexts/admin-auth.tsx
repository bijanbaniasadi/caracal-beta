'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  adminLogin,
  adminLogout,
  getStoredSession,
} from '@/lib/api/admin-client';
import type { AdminLoginInput, AdminSession } from '@/lib/api/admin-types';

// ─── Context ──────────────────────────────────────────────────────────────────

interface AdminAuthState {
  session: AdminSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: AdminLoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (input: AdminLoginInput) => {
      const newSession = await adminLogin(input);
      setSession(newSession);
      router.replace('/admin/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    await adminLogout();
    setSession(null);
    router.replace('/admin/login');
  }, [router]);

  return (
    <AdminAuthContext.Provider
      value={{
        session,
        isLoading,
        isAuthenticated: session !== null,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  }
  return ctx;
}
