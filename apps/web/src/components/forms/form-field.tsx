import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';

// ─── Input class builders ─────────────────────────────────────────────────────

const BASE_INPUT =
  'w-full rounded-md border px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-1 ' +
  'disabled:bg-slate-50 disabled:text-slate-500 transition-colors';

/** Returns the full className string for a text/email/tel/number <input>. */
export function inputCls(hasError = false): string {
  return hasError
    ? `${BASE_INPUT} border-red-400 focus:border-red-400 focus:ring-red-400`
    : `${BASE_INPUT} border-slate-300 focus:border-slate-500 focus:ring-slate-500`;
}

/** Returns the full className string for a <textarea>. */
export function textareaCls(hasError = false): string {
  return `${inputCls(hasError)} resize-none`;
}

// ─── Generic change-handler factory ──────────────────────────────────────────

/**
 * Creates a stable onChange handler that writes `e.target.value` into a
 * single key of the form-state object.
 *
 * Usage:
 *   onChange={fieldSetter(setForm, 'customerName')}
 */
/**
 * Returns an onChange handler that writes `e.target.value` into a single key
 * of the form-state object. Safe to use for any all-string form state because
 * we cast the result back to TState — TypeScript can't prove the invariant
 * without an explicit index signature, but the runtime behaviour is correct.
 */
export function fieldSetter<TState>(
  setState: Dispatch<SetStateAction<TState>>,
  key: keyof TState,
) {
  return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setState((prev) => ({ ...prev, [key]: e.target.value } as TState));
  };
}

// ─── FormField wrapper ────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** First error string from fieldErrors[key]. Renders red beneath the input. */
  error?: string;
  /** Descriptive hint shown when there is no error. */
  hint?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>

      {children}

      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
