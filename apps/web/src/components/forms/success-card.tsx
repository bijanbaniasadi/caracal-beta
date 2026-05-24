interface SuccessCardProps {
  referenceCode: string;
  title?: string;
  description?: string;
  onReset: () => void;
  resetLabel?: string;
}

/**
 * Replaces the form when a submission succeeds.
 * Displays the backend reference code in a monospace chip.
 */
export function SuccessCard({
  referenceCode,
  title = 'Submitted successfully',
  description,
  onReset,
  resetLabel = 'Submit another',
}: SuccessCardProps) {
  return (
    <div
      role="status"
      className="rounded-lg border border-green-200 bg-green-50 px-6 py-10 text-center"
    >
      {/* Check icon */}
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
        <span className="text-xl leading-none text-green-600" aria-hidden="true">
          ✓
        </span>
      </div>

      <h2 className="mt-4 text-lg font-semibold text-green-900">{title}</h2>

      {description && (
        <p className="mt-1 text-sm text-green-700">{description}</p>
      )}

      {/* Reference code chip */}
      <div className="mt-5 inline-block rounded-md border border-slate-200 bg-white px-5 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Reference
        </p>
        <p className="mt-0.5 font-mono text-base font-semibold tracking-wide text-slate-900">
          {referenceCode}
        </p>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-green-700 underline underline-offset-2 hover:text-green-900"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
