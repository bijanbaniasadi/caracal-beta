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
  customerLogin,
  customerLogout,
  customerRegister,
  getStoredCustomerSession,
} from '@/lib/api/account-client';
import type {
  CustomerLoginInput,
  CustomerRegisterInput,
  CustomerSession,
} from '@/lib/api/account-types';

// ─── Context shape ─────────────────────────────────────────────────────────────

interface AccountAuthState {
  session: CustomerSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: CustomerLoginInput) => Promise<void>;
  register: (input: CustomerRegisterInput) => Promise<void>;
  logout: () => void;
}

const AccountAuthContext = createContext<AccountAuthState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AccountAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = getStoredCustomerSession();
    setSession(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (input: CustomerLoginInput) => {
      const newSession = await customerLogin(input);
      setSession(newSession);
      router.replace('/account');
    },
    [router]
  );

  const register = useCallback(
    async (input: CustomerRegisterInput) => {
      const newSession = await customerRegister(input);
      setSession(newSession);
      router.replace('/account');
    },
    [router]
  );

  const logout = useCallback(() => {
    customerLogout();
    setSession(null);
    router.replace('/login');
  }, [router]);

  return (
    <AccountAuthContext.Provider
      value={{ session, isLoading, isAuthenticated: session !== null, login, register, logout }}
    >
      {children}
    </AccountAuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAccountAuth(): AccountAuthState {
  const ctx = useContext(AccountAuthContext);
  if (!ctx) throw new Error('useAccountAuth must be used inside <AccountAuthProvider>');
  return ctx;
}
