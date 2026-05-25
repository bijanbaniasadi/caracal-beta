'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';

import { useCustomerAuth } from '@/contexts/customer-auth';
import {
  createEcuPatcherJob,
  downloadEcuPatcherResult,
  getEcuPatcherAccess,
  listEcuPatcherJobs,
  requestEcuPatcherAccess,
} from '@/lib/api/ecu-patcher-client';
import type {
  EcuPatcherAccess,
  EcuPatcherJob,
  EcuPatcherModule,
} from '@/lib/api/ecu-patcher-types';

const WHATSAPP =
  'https://wa.me/971585796760?text=Hi%2C%20I%20need%20support%20with%20ECU%20Patcher';

const MODULES: Array<{
  id: EcuPatcherModule;
  name: string;
  family: string;
  meta: string;
  expectedSize: number | null;
  patchCount: string;
  output: string;
  warning: string;
}> = [
  {
    id: 'DCM71B_DPF',
    name: 'DPF-Off',
    family: 'PSA Delphi DCM7.1b',
    meta: 'Boxer, Jumper, Relay, Ducato 2.2 HDi',
    expectedSize: 6_291_456,
    patchCount: '276 legacy patches',
    output: '_DPF_off.bin',
    warning: 'Optional legacy checksum marker is available for this module.',
  },
  {
    id: 'DCM71B_EGR',
    name: 'EGR-Off',
    family: 'PSA Delphi DCM7.1b',
    meta: 'Boxer, Jumper, Relay, Ducato 2.2 HDi',
    expectedSize: 6_291_456,
    patchCount: '75 legacy patches',
    output: '_EGR_off.bin',
    warning: 'Checksum is not modified. Verify externally before any write-back.',
  },
  {
    id: 'SID208_DPF_EGR',
    name: 'DPF+EGR',
    family: 'PSA Siemens SID208',
    meta: 'Boxer, Jumper, Relay 2.2 HDi',
    expectedSize: 4_194_304,
    patchCount: '79 legacy patches',
    output: '_DPF_EGR_off.bin',
    warning: 'Checksum is not modified. Verify externally before any write-back.',
  },
  {
    id: 'DTC_REMOVER',
    name: 'DTC Remover',
    family: 'Universal heuristic',
    meta: 'Stride-2 DTC table scan from legacy tool',
    expectedSize: null,
    patchCount: 'Detected table entries',
    output: '_DTC_patched.bin',
    warning: 'The backend applies the legacy all-off action to detected table candidates.',
  },
];

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'n/a';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function statusClass(status: string): string {
  if (status === 'COMPLETED' || status === 'APPROVED') return 'text-emerald-300 bg-emerald-500/10';
  if (status === 'RUNNING' || status === 'PENDING') return 'text-amber-300 bg-amber-500/10';
  if (status === 'FAILED' || status === 'REJECTED') return 'text-red-300 bg-red-500/10';
  return 'text-brand-muted bg-white/5';
}

function moduleInfo(module: EcuPatcherModule) {
  return MODULES.find((item) => item.id === module) ?? MODULES[0];
}

export function EcuPatcherPage() {
  const { session, isLoading } = useCustomerAuth();
  const [access, setAccess] = useState<EcuPatcherAccess | null>(null);
  const [jobs, setJobs] = useState<EcuPatcherJob[]>([]);
  const [activeModule, setActiveModule] = useState<EcuPatcherModule>('DCM71B_DPF');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [fixChecksum, setFixChecksum] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EcuPatcherJob | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => moduleInfo(activeModule), [activeModule]);

  useEffect(() => {
    if (isLoading || !session) return;

    let mounted = true;
    async function load() {
      setLoadingState(true);
      setError(null);
      try {
        const [nextAccess, nextJobs] = await Promise.all([
          getEcuPatcherAccess(),
          listEcuPatcherJobs(),
        ]);
        if (!mounted) return;
        setAccess(nextAccess);
        setJobs(nextJobs);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load patcher state.');
      } finally {
        if (mounted) setLoadingState(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [isLoading, session]);

  const submitAccessRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await requestEcuPatcherAccess(notes.trim() || undefined);
      setAccess(next);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to request patcher access.'
      );
    } finally {
      setBusy(false);
    }
  };

  const submitPatchJob = async () => {
    if (!file) {
      setError('Select a .bin, .ori, or .hex file first.');
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const job = await createEcuPatcherJob({
        module: activeModule,
        file,
        fixChecksum: activeModule === 'DCM71B_DPF' ? fixChecksum : false,
      });
      setResult(job);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : 'Unable to process this file.');
    } finally {
      setBusy(false);
    }
  };

  const downloadResult = async (job: EcuPatcherJob) => {
    setBusy(true);
    setError(null);
    try {
      await downloadEcuPatcherResult(job);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#071015] text-brand-text">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,122,24,0.16),transparent_34%),linear-gradient(135deg,#071015,#0c1720)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8 lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-orange">
              Legacy ECU Patcher
            </p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-black leading-tight text-brand-text sm:text-5xl">
              Restored workshop patcher with account history and job tracking
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-brand-muted">
              Migrated from the old PHP workflow into the current CaracalTech platform. Upload a
              supported ECU file, run a legacy module, review status, then download the generated
              result from your account-backed job record.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#patcher-workbench"
                className="rounded-md bg-brand-orange px-5 py-3 text-sm font-bold text-white hover:opacity-90"
              >
                Open workbench
              </a>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-white/15 px-5 py-3 text-sm font-bold text-brand-text hover:bg-white/5"
              >
                WhatsApp fallback
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
              Legacy behavior map
            </p>
            <div className="mt-4 grid gap-3 text-sm text-brand-muted">
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <strong className="block text-brand-text">Access gate</strong>
                Customer login plus approval status replaces PHP session/license checks.
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <strong className="block text-brand-text">Patch modules</strong>
                DCM7.1b DPF, DCM7.1b EGR, SID208 DPF+EGR, and legacy DTC heuristic.
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <strong className="block text-brand-text">Account trail</strong>
                Original upload, job metadata, result hash, and download status are persisted.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="patcher-workbench" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-5 rounded-md border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!session && !isLoading ? (
          <SignedOutGate />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-brand-muted">Modules</p>
                  <p className="mt-1 text-sm font-bold text-brand-text">ECU Suite</p>
                </div>
                {access && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${statusClass(access.status ?? 'NONE')}`}
                  >
                    {access.status ?? 'LOGIN'}
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-2">
                {MODULES.map((module) => (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(module.id);
                      setResult(null);
                    }}
                    className={[
                      'rounded-md border px-3 py-3 text-left text-sm transition',
                      activeModule === module.id
                        ? 'border-brand-orange bg-brand-orange/10 text-brand-text'
                        : 'border-white/10 bg-black/20 text-brand-muted hover:bg-white/5',
                    ].join(' ')}
                  >
                    <span className="block font-bold">{module.name}</span>
                    <span className="mt-1 block text-xs">{module.family}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-brand-muted">
                Jobs also appear in account upload history because the original file is stored as a
                platform `BinUpload`.
                <Link href="/account/uploads" className="mt-2 block font-bold text-brand-orange">
                  View account uploads
                </Link>
              </div>
            </aside>

            <main className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035]">
              {loadingState ? (
                <div className="p-8 text-sm text-brand-muted">Loading patcher access...</div>
              ) : access?.hasAccess ? (
                <Workbench
                  active={active}
                  activeModule={activeModule}
                  busy={busy}
                  file={file}
                  fixChecksum={fixChecksum}
                  inputRef={inputRef}
                  jobs={jobs}
                  result={result}
                  setFile={setFile}
                  setFixChecksum={setFixChecksum}
                  submitPatchJob={submitPatchJob}
                  downloadResult={downloadResult}
                />
              ) : (
                <AccessGate
                  access={access}
                  busy={busy}
                  notes={notes}
                  setNotes={setNotes}
                  submitAccessRequest={submitAccessRequest}
                />
              )}
            </main>
          </div>
        )}
      </section>
    </div>
  );
}

function SignedOutGate() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">
        Account required
      </p>
      <h2 className="mt-2 font-display text-2xl font-black text-brand-text">
        Sign in to restore the legacy patcher workflow
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
        The old PHP page used a client login and admin-approved license. The new route keeps that
        commercial flow with JWT sessions and customer account visibility.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/login?returnTo=/ecu-patcher"
          className="rounded-md bg-brand-orange px-4 py-2 text-sm font-bold text-white"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-brand-text"
        >
          Register
        </Link>
      </div>
    </div>
  );
}

function AccessGate({
  access,
  busy,
  notes,
  setNotes,
  submitAccessRequest,
}: {
  access: EcuPatcherAccess | null;
  busy: boolean;
  notes: string;
  setNotes: (value: string) => void;
  submitAccessRequest: () => void;
}) {
  const status = access?.status ?? null;

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
          Patcher access
        </p>
        <h2 className="mt-2 font-display text-2xl font-black text-brand-text">
          One-time 1,200 AED account unlock
        </h2>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          The legacy page required an approved `patcher_licenses` row before exposing the tool. This
          migration keeps the same approval flow, now backed by Prisma and audit logs.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {['DCM7.1b DPF-Off', 'DCM7.1b EGR-Off', 'SID208 DPF+EGR', 'DTC heuristic remover'].map(
            (item) => (
              <div key={item} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">
                <span className="text-brand-orange">OK</span>{' '}
                <span className="text-brand-text">{item}</span>
              </div>
            )
          )}
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        {status === 'PENDING' ? (
          <>
            <p className="text-lg font-bold text-amber-200">Request pending</p>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Send payment proof on WhatsApp. Admin approval unlocks the workbench instantly.
            </p>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block rounded-md bg-brand-orange px-4 py-2 text-center text-sm font-bold text-white"
            >
              Send proof on WhatsApp
            </a>
          </>
        ) : status === 'REJECTED' ? (
          <>
            <p className="text-lg font-bold text-red-200">Access not approved</p>
            <p className="mt-2 text-sm leading-6 text-brand-muted">
              Contact support to resolve payment or account verification.
            </p>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block rounded-md bg-brand-orange px-4 py-2 text-center text-sm font-bold text-white"
            >
              Contact support
            </a>
          </>
        ) : (
          <>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
              Notes for admin
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Vehicle, ECU family, payment method, or WhatsApp reference..."
              className="mt-2 min-h-28 w-full rounded-md border border-white/10 bg-[#071015] px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-orange"
            />
            <button
              type="button"
              onClick={submitAccessRequest}
              disabled={busy}
              className="mt-3 w-full rounded-md bg-brand-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Submitting...' : 'Request access'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Workbench({
  active,
  activeModule,
  busy,
  file,
  fixChecksum,
  inputRef,
  jobs,
  result,
  setFile,
  setFixChecksum,
  submitPatchJob,
  downloadResult,
}: {
  active: ReturnType<typeof moduleInfo>;
  activeModule: EcuPatcherModule;
  busy: boolean;
  file: File | null;
  fixChecksum: boolean;
  inputRef: RefObject<HTMLInputElement>;
  jobs: EcuPatcherJob[];
  result: EcuPatcherJob | null;
  setFile: (file: File | null) => void;
  setFixChecksum: (value: boolean) => void;
  submitPatchJob: () => void;
  downloadResult: (job: EcuPatcherJob) => void;
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_340px]">
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-brand-muted">{active.family}</p>
            <h2 className="mt-1 font-display text-2xl font-black text-brand-text">{active.name}</h2>
            <p className="mt-2 text-sm text-brand-muted">{active.meta}</p>
          </div>
          <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-bold text-brand-orange">
            {active.patchCount}
          </span>
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
              Input file
            </label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-2 flex min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 px-4 text-center hover:border-brand-orange/70"
            >
              <span className="text-sm font-bold text-brand-text">
                {file ? file.name : 'Drop support uses browser picker here'}
              </span>
              <span className="mt-1 text-xs text-brand-muted">
                {file ? formatBytes(file.size) : 'Accepted: .bin, .ori, .hex'}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".bin,.ori,.hex"
              className="hidden"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-brand-muted sm:grid-cols-2">
            <div>
              <span className="block text-xs uppercase tracking-[0.14em]">Expected size</span>
              <strong className="mt-1 block text-brand-text">
                {active.expectedSize ? `${active.expectedSize.toLocaleString()} bytes` : 'variable'}
              </strong>
            </div>
            <div>
              <span className="block text-xs uppercase tracking-[0.14em]">Output suffix</span>
              <strong className="mt-1 block font-mono text-brand-text">{active.output}</strong>
            </div>
            <div className="sm:col-span-2">
              <span className="block text-xs uppercase tracking-[0.14em]">Important</span>
              <p className="mt-1 text-amber-200">{active.warning}</p>
            </div>
          </div>

          {activeModule === 'DCM71B_DPF' && (
            <label className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-brand-muted">
              <input
                type="checkbox"
                checked={fixChecksum}
                onChange={(event) => setFixChecksum(event.target.checked)}
                className="h-4 w-4 accent-brand-orange"
              />
              Fix checksum marker after patching
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submitPatchJob}
              disabled={busy || !file}
              className="rounded-md bg-brand-orange px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Processing...' : `Run ${active.name}`}
            </button>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={busy}
                className="rounded-md border border-white/15 px-5 py-3 text-sm font-bold text-brand-text hover:bg-white/5 disabled:opacity-50"
              >
                Clear file
              </button>
            )}
          </div>
        </div>

        {result && <ResultPanel job={result} busy={busy} downloadResult={downloadResult} />}
      </div>

      <aside className="border-t border-white/10 bg-black/20 p-5 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-brand-text">Recent jobs</h3>
          <span className="text-xs text-brand-muted">{jobs.length}</span>
        </div>
        <div className="mt-4 grid gap-3">
          {jobs.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-black/20 p-4 text-sm text-brand-muted">
              No patcher jobs yet.
            </p>
          ) : (
            jobs.slice(0, 8).map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => undefined}
                className="rounded-md border border-white/10 bg-[#071015] p-3 text-left"
              >
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(job.status)}`}>
                  {job.status}
                </span>
                <strong className="mt-2 block truncate text-sm text-brand-text">
                  {job.originalFileName}
                </strong>
                <span className="mt-1 block text-xs text-brand-muted">
                  {moduleInfo(job.module).name} | {formatBytes(job.originalByteSize)}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function ResultPanel({
  job,
  busy,
  downloadResult,
}: {
  job: EcuPatcherJob;
  busy: boolean;
  downloadResult: (job: EcuPatcherJob) => void;
}) {
  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`rounded-full px-2.5 py-1 text-xs ${statusClass(job.status)}`}>
            {job.status}
          </span>
          <h3 className="mt-3 text-lg font-bold text-brand-text">
            {job.resultFileName ?? job.originalFileName}
          </h3>
          <p className="mt-1 text-sm text-brand-muted">
            Applied {job.patches.applied} of {job.patches.total} patch entries. Result hash:{' '}
            <span className="font-mono">{job.resultSha256?.slice(0, 16) ?? 'n/a'}</span>
          </p>
        </div>
        {job.downloadUrl && (
          <button
            type="button"
            onClick={() => downloadResult(job)}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Download result
          </button>
        )}
      </div>

      {job.failure && (
        <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {job.failure.message ?? job.failure.code}
        </div>
      )}

      {job.logs && (
        <div className="mt-4 max-h-56 overflow-auto rounded-md border border-white/10 bg-[#05090d] p-3 font-mono text-xs leading-6">
          {job.logs.map((line, index) => (
            <div
              key={`${line.message}-${index}`}
              className={
                line.level === 'ok'
                  ? 'text-emerald-300'
                  : line.level === 'warn'
                    ? 'text-amber-300'
                    : line.level === 'error'
                      ? 'text-red-300'
                      : 'text-brand-muted'
              }
            >
              {line.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
