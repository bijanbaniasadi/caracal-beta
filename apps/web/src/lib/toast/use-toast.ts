'use client';

/**
 * Public hook for dispatching toasts.
 *
 * Usage:
 *   const { success, error, info, warning, addToast, removeToast } = useToast();
 *   success('Saved!');
 *   error('Something went wrong', 'Details here', requestId);
 */

import { useToastContext } from './context';
import type { ToastInput } from './types';

export type { Toast, ToastInput, ToastVariant } from './types';

export interface UseToastReturn {
  /** Low-level: add any toast with a full ToastInput. Returns the generated id. */
  addToast: (input: ToastInput) => string;
  /** Remove a toast immediately by id. */
  removeToast: (id: string) => void;
  /** Shorthand helpers */
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string, requestId?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
}

export function useToast(): UseToastReturn {
  const { addToast, removeToast } = useToastContext();

  return {
    addToast,
    removeToast,
    success: (title, description) =>
      addToast({ variant: 'success', title, description }),
    error: (title, description, requestId) =>
      addToast({ variant: 'error', title, description, requestId }),
    info: (title, description) =>
      addToast({ variant: 'info', title, description }),
    warning: (title, description) =>
      addToast({ variant: 'warning', title, description }),
  };
}
