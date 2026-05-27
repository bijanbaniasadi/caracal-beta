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

import { getProjectionCurrencyRates } from '@/lib/api/projection-catalog-client';
import type {
  DisplayCurrency,
  ProjectionCurrencyRates,
} from '@/lib/api/projection-catalog-types';

export const displayCurrencies: DisplayCurrency[] = ['AED', 'USD', 'EUR', 'GBP'];

interface CurrencyDisplayState {
  currency: DisplayCurrency;
  rates: ProjectionCurrencyRates['rates'];
  updatedAt: string | null;
  setCurrency: (currency: DisplayCurrency) => void;
}

const FALLBACK_RATES: ProjectionCurrencyRates['rates'] = {
  AED: 1,
};
const STORAGE_KEY = 'caracal.displayCurrency.v1';
const CurrencyDisplayContext = createContext<CurrencyDisplayState | null>(null);

function isDisplayCurrency(value: string | null): value is DisplayCurrency {
  return displayCurrencies.includes(value as DisplayCurrency);
}

export function CurrencyDisplayProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>('AED');
  const [rates, setRates] = useState<ProjectionCurrencyRates['rates']>(FALLBACK_RATES);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDisplayCurrency(stored)) {
      setCurrencyState(stored);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRates() {
      try {
        const response = await getProjectionCurrencyRates();
        if (!active) return;
        setRates({ ...FALLBACK_RATES, ...response.rates });
        setUpdatedAt(response.updatedAt);
      } catch {
        if (!active) return;
        setRates(FALLBACK_RATES);
        setUpdatedAt(null);
        setCurrencyState('AED');
      }
    }

    void loadRates();

    return () => {
      active = false;
    };
  }, []);

  const setCurrency = useCallback((nextCurrency: DisplayCurrency) => {
    setCurrencyState(nextCurrency);
    window.localStorage.setItem(STORAGE_KEY, nextCurrency);
  }, []);

  const value = useMemo<CurrencyDisplayState>(
    () => ({ currency, rates, updatedAt, setCurrency }),
    [currency, rates, setCurrency, updatedAt]
  );

  return (
    <CurrencyDisplayContext.Provider value={value}>
      {children}
    </CurrencyDisplayContext.Provider>
  );
}

export function useCurrencyDisplay(): CurrencyDisplayState {
  const context = useContext(CurrencyDisplayContext);
  if (!context) {
    throw new Error('useCurrencyDisplay must be used inside <CurrencyDisplayProvider>');
  }
  return context;
}
