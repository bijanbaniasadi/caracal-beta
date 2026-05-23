'use client';

/**
 * Toast stack — renders the global notification queue as a fixed overlay in
 * the bottom-right corner.
 *
 * Placed inside both <ToastProvider> and <ApiProvider> by the root Providers
 * component so it has access to both contexts.
 *
 * In development mode, each toast that carries a backend request-id will show
 * it in a small monospace annotation beneath the description.
 */

import { useToastContext } from '@/lib/toast/context';
import type { Toast, ToastVariant } from '@/lib/toast/types';
import { useApiConfig } from '@/providers/api-provider';

// ─── Variant config ───────────────────────────────────────────────────────────

const variantClasses: Record<ToastVariant, string> = {
  success: 'bg-green-50 border-green-400 text-green-900',
  error:   'bg-red-50   border-red-400   text-red-900',
  info:    'bg-sky-50   border-sky-400   text-sky-900',
  warning: 'bg-amber-50 border-amber-400 text-amber-900',
};

const variantIcon: Record<ToastVariant, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

// ─── Single toast item ────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  isDev: boolean;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, isDev, onDismiss }: ToastItemProps) {
  return (
    <div
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={[
        'flex items-start gap-3 w-80 rounded-lg border px-4 py-3 shadow-lg',
        variantClasses[toast.variant],
      ].join(' ')}
    >
      {/* Variant icon */}
      <span
        className="mt-0.5 shrink-0 text-sm font-bold leading-none"
        aria-hidden="true"
      >
        {variantIcon[toast.variant]}
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{toast.title}</p>

        {toast.description && (
          <p className="mt-0.5 break-words text-sm opacity-80">
            {toast.description}
          </p>
        )}

        {/* Request-id annotation — development only */}
        {isDev && toast.requestId && (
          <p className="mt-1 font-mono text-xs opacity-50">
            req&nbsp;{toast.requestId}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="mt-0.5 shrink-0 text-base leading-none opacity-50 hover:opacity-100 focus:outline-none"
      >
        ×
      </button>
    </div>
  );
}

// ─── Stack container ──────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts, removeToast } = useToastContext();
  const { isDev } = useApiConfig();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} isDev={isDev} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
}
