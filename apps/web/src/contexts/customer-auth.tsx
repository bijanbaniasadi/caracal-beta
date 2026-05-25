'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  customerLogin,
  customerLogout,
  customerRegister,
  getStoredCustomerSession,
  restoreCustomerSession,
} from '@/lib/api/customer-client';
import type { CustomerSession, LoginInput, RegisterInput } from '@/lib/api/customer-types';

interface CustomerAuthState {
  session: CustomerSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<CustomerSession>;
  register: (input: RegisterInput) => Promise<CustomerSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<CustomerSession | null>;
  setSession: (session: CustomerSession | null) => void;
}

const CustomerAuthContext = createContext<CustomerAuthState | null>(null);

function isCustomerSession(session: CustomerSession): boolean {
  return session.user.role === 'customer';
}

function assertCustomerSession(session: CustomerSession): CustomerSession {
  if (session.user.role !== 'customer') {
    throw new Error('Please use the admin portal for staff access.');
  }

  return session;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restore() {
      const stored = getStoredCustomerSession();
      if (stored?.user.role === 'customer') {
        setSession(stored);
      }

      const restored = await restoreCustomerSession();
      if (!active) return;
      setSession(restored?.user.role === 'customer' ? restored : null);
      setIsLoading(false);
    }

    void restore();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const nextSession = await customerLogin(input);
    if (!isCustomerSession(nextSession)) {
      await customerLogout();
      assertCustomerSession(nextSession);
    }
    setSession(nextSession);
    return nextSession;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const nextSession = await customerRegister(input);
    if (!isCustomerSession(nextSession)) {
      await customerLogout();
      assertCustomerSession(nextSession);
    }
    setSession(nextSession);
    return nextSession;
  }, []);

  const logout = useCallback(async () => {
    await customerLogout();
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    const nextSession = await restoreCustomerSession();
    const customerSession = nextSession?.user.role === 'customer' ? nextSession : null;
    setSession(customerSession);
    return customerSession;
  }, []);

  const value = useMemo<CustomerAuthState>(
    () => ({
      session,
      isLoading,
      isAuthenticated: session !== null,
      login,
      register,
      logout,
      refresh,
      setSession,
    }),
    [isLoading, login, logout, refresh, register, session]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth(): CustomerAuthState {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used inside <CustomerAuthProvider>');
  }
  return context;
}
