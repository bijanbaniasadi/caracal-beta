// ─── Toast types ─────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  /** Auto-generated, unique within the session. */
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /**
   * Auto-dismiss delay in ms. 0 = persist until the user dismisses manually.
   * Defaults to 5 000 ms when not specified.
   */
  duration?: number;
  /**
   * Backend request-id from the ApiMeta envelope.
   * Displayed only when process.env.NODE_ENV === 'development'.
   */
  requestId?: string;
}

/** Shape passed to addToast — identical to Toast without the generated id. */
export type ToastInput = Omit<Toast, 'id'>;

export type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

export interface ToastContextValue {
  toasts: Toast[];
  /** Schedules a toast and returns its generated id. */
  addToast: (input: ToastInput) => string;
  /** Immediately removes a toast by id. */
  removeToast: (id: string) => void;
}
