'use client';

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import type { Toast, ToastAction, ToastContextValue, ToastInput } from './types';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_DURATION_MS = 5_000;
const MAX_VISIBLE = 5;

// ─── Reducer ─────────────────────────────────────────────────────────────────

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'ADD':
      // Newest first; clamp to MAX_VISIBLE so the stack never overflows.
      return [action.toast, ...state].slice(0, MAX_VISIBLE);
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  const addToast = useCallback(
    (input: ToastInput): string => {
      const id = `t${(counterRef.current += 1)}`;
      const duration = input.duration ?? DEFAULT_DURATION_MS;
      dispatch({ type: 'ADD', toast: { ...input, id, duration } });

      // Schedule auto-dismiss unless duration is explicitly 0 (persist).
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

// ─── Internal hook (for use by the Toaster component) ────────────────────────

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be called inside <ToastProvider>');
  }
  return ctx;
}
