'use client';

import { useRef, useState } from 'react';

import { CaracalApiError } from '@/lib/api';
import type { BinUploadConfirmation } from '@/lib/api';
import { useBinUpload } from '@/hooks/mutations/use-bin-upload';
import { useApiConfig } from '@/providers/api-provider';
import { FormField, inputCls, textareaCls } from './form-field';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateSha(sha: string): string {
  return sha.length > 16 ? `${sha.slice(0, 16)}…` : sha;
}

// ─── Upload confirmation panel ────────────────────────────────────────────────

function UploadSuccess({
  result,
  onReset,
}: {
  result: BinUploadConfirmation;
  onReset: () => void;
}) {
  return (
    <div
      role="status"
      className="rounded-lg border border-green-200 bg-green-50 px-6 py-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
          <span className="text-lg leading-none text-green-600" aria-hidden="true">
            ✓
          </span>
        </div>
        <div>
          <h2 className="text-base font-semibold text-green-900">
            File uploaded successfully
          </h2>
          <p className="text-sm text-green-700">
            Stored as{' '}
            <span className="font-mono font-medium">{result.originalFileName}</span>
          </p>
        </div>
      </div>

      {/* Detail grid */}
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-slate-200 bg-white px-4 py-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Size
          </dt>
          <dd className="mt-0.5 text-slate-800">{formatBytes(result.byteSize)}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Storage
          </dt>
          <dd className="mt-0.5 text-slate-800">{result.storageProvider}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Status
          </dt>
          <dd className="mt-0.5 text-slate-800">{result.status}</dd>
        </div>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">
            SHA-256
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-slate-600">
            {truncateSha(result.sha256)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-green-700 underline underline-offset-2 hover:text-green-900"
        >
          Upload another file
        </button>
      </div>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function BinUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [productContext, setProductContext] = useState('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, progress, isPending, isSuccess, data, error, reset } = useBinUpload();
  const { isDev } = useApiConfig();

  const fe =
    error instanceof CaracalApiError
      ? (error.getFieldErrors()?.fieldErrors ?? {})
      : {};
  const formErrors =
    error instanceof CaracalApiError
      ? (error.getFieldErrors()?.formErrors ?? [])
      : [];

  const handleReset = () => {
    reset();
    setFile(null);
    setRequesterName('');
    setRequesterEmail('');
    setProductContext('');
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Success state ────────────────────────────────────────────────────────
  if (isSuccess && data) {
    return <UploadSuccess result={data} onReset={handleReset} />;
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        try {
          await upload({
            file,
            ...(requesterName && { requesterName }),
            ...(requesterEmail && { requesterEmail }),
            ...(productContext && { productContext }),
            ...(notes && { notes }),
          });
        } catch {
          // Hook's onError fires the toast; error state updates automatically.
        }
      }}
    >
      {/* ── File picker ─────────────────────────────────────────────── */}
      <FormField
        label="ECU bin file"
        htmlFor="bu-file"
        required
        error={fe['file']?.[0]}
        hint="Only .bin files accepted — maximum 50 MB"
      >
        <div
          className={[
            'flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8',
            'transition-colors',
            fe['file']?.[0]
              ? 'border-red-300 bg-red-50'
              : file
                ? 'border-green-300 bg-green-50'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400',
          ].join(' ')}
        >
          {file ? (
            <div className="text-center">
              <p className="font-mono text-sm font-medium text-slate-800">
                {file.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatBytes(file.size)}
              </p>
              {!isPending && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="mt-2 text-xs text-slate-500 underline hover:text-slate-700"
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                Drop a .bin file here, or
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 text-sm font-semibold text-slate-900 underline underline-offset-2 hover:text-slate-700"
              >
                browse to select
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          id="bu-file"
          type="file"
          accept=".bin"
          className="sr-only"
          disabled={isPending}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) setFile(picked);
          }}
        />
      </FormField>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      {isPending && (
        <div aria-label={`Upload progress: ${progress}%`}>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-full rounded-full bg-slate-900 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Optional metadata ────────────────────────────────────────── */}
      <div className="space-y-5 border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Optional metadata
        </p>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Your name"
            htmlFor="bu-name"
            error={fe['requesterName']?.[0]}
          >
            <input
              id="bu-name"
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="Full name"
              disabled={isPending}
              autoComplete="name"
              className={inputCls(!!fe['requesterName']?.[0])}
            />
          </FormField>

          <FormField
            label="Email"
            htmlFor="bu-email"
            error={fe['requesterEmail']?.[0]}
          >
            <input
              id="bu-email"
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isPending}
              autoComplete="email"
              className={inputCls(!!fe['requesterEmail']?.[0])}
            />
          </FormField>
        </div>

        <FormField
          label="Product context"
          htmlFor="bu-context"
          error={fe['productContext']?.[0]}
          hint="e.g. KESS3 Master, AutoTuner — the tool this file relates to"
        >
          <input
            id="bu-context"
            type="text"
            value={productContext}
            onChange={(e) => setProductContext(e.target.value)}
            placeholder="KESS3 Master"
            disabled={isPending}
            className={inputCls(!!fe['productContext']?.[0])}
          />
        </FormField>

        <FormField
          label="Notes"
          htmlFor="bu-notes"
          error={fe['notes']?.[0]}
        >
          <textarea
            id="bu-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Vehicle details, specific issues, or anything else we should know…"
            disabled={isPending}
            className={textareaCls(!!fe['notes']?.[0])}
          />
        </FormField>
      </div>

      {/* ── Form-level errors ──────────────────────────────────────────── */}
      {formErrors.length > 0 && (
        <div className="space-y-1 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          {formErrors.map((msg, i) => (
            <p key={i} className="text-sm text-red-700">
              {msg}
            </p>
          ))}
        </div>
      )}

      {/* ── Dev: request-id ────────────────────────────────────────────── */}
      {isDev && error instanceof CaracalApiError && error.requestId && (
        <p className="font-mono text-xs text-slate-400">
          req&nbsp;{error.requestId}
        </p>
      )}

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={isPending || !file}
        className={[
          'w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white',
          'transition-colors focus:outline-none focus:ring-2',
          'focus:ring-slate-500 focus:ring-offset-2',
          isPending || !file
            ? 'cursor-not-allowed bg-slate-400'
            : 'bg-slate-900 hover:bg-slate-700',
        ].join(' ')}
      >
        {isPending ? `Uploading… ${progress}%` : 'Upload File'}
      </button>
    </form>
  );
}
