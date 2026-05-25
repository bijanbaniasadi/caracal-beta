'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type RefObject,
} from 'react';

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
  EcuPatcherJobStatus,
  EcuPatcherModule,
} from '@/lib/api/ecu-patcher-types';

const WHATSAPP =
  'https://wa.me/971585796760?text=Hi%2C%20I%20need%20support%20with%20ECU%20Patcher%202.0';

const ACCEPTED_EXTENSIONS = ['.bin', '.ori', '.hex'] as const;

const MODULES = [
  {
    id: 'DCM71B_DPF',
    shortName: 'DPF-Off',
    name: 'DCM7.1b DPF-Off',
    family: 'PSA Delphi DCM7.1b',
    compatible: 'Boxer, Jumper, Relay, Ducato 2.2 HDi',
    expectedSize: 6_291_456,
    patchCount: '276 patches',
    output: '_DPF_off.bin',
    checksumSupported: true,
    engine: 'Viezu verified checksum marker',
    warning: 'Optional legacy checksum marker is available for this module.',
  },
  {
    id: 'DCM71B_EGR',
    shortName: 'EGR-Off',
    name: 'DCM7.1b EGR-Off',
    family: 'PSA Delphi DCM7.1b',
    compatible: 'Boxer, Jumper, Relay, Ducato 2.2 HDi',
    expectedSize: 6_291_456,
    patchCount: '75 patches',
    output: '_EGR_off.bin',
    checksumSupported: false,
    engine: 'TUNERPAD legacy patch set',
    warning: 'Checksum is not modified. Verify externally before any write-back.',
  },
  {
    id: 'SID208_DPF_EGR',
    shortName: 'SID208',
    name: 'SID208 DPF+EGR',
    family: 'PSA Siemens SID208',
    compatible: 'Boxer, Jumper, Relay 2.2 HDi',
    expectedSize: 4_194_304,
    patchCount: '79 patches',
    output: '_DPF_EGR_off.bin',
    checksumSupported: false,
    engine: 'DaVinci legacy patch set',
    warning: 'Checksum is not modified. Verify externally before any write-back.',
  },
  {
    id: 'DTC_REMOVER',
    shortName: 'DTC',
    name: 'DTC Remover',
    family: 'Universal heuristic',
    compatible: 'Stride-2 DTC table candidates',
    expectedSize: null,
    patchCount: 'Detected entries',
    output: '_DTC_patched.bin',
    checksumSupported: false,
    engine: 'Legacy table scan',
    warning: 'The backend applies the legacy all-off action to detected table candidates.',
  },
] satisfies Array<{
  id: EcuPatcherModule;
  shortName: string;
  name: string;
  family: string;
  compatible: string;
  expectedSize: number | null;
  patchCount: string;
  output: string;
  checksumSupported: boolean;
  engine: string;
  warning: string;
}>;

type ModuleDisplay = (typeof MODULES)[number];
type TimelineState = 'idle' | 'active' | 'complete' | 'error';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index).toLowerCase() : '';
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return 'n/a';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'n/a';
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatMoney(
  cents: number | null | undefined,
  currency: string | null | undefined
): string {
  return `${((cents ?? 120_000) / 100).toLocaleString('en-AE')} ${currency ?? 'AED'}`;
}

function statusLabel(status: string | null | undefined): string {
  return status ?? 'NOT REQUESTED';
}

function statusClass(status: string | null | undefined): string {
  if (status === 'COMPLETED' || status === 'APPROVED') {
    return 'border-ecu-green/25 bg-ecu-green/10 text-emerald-300';
  }
  if (status === 'RUNNING' || status === 'QUEUED' || status === 'PENDING') {
    return 'border-ecu-amber/25 bg-ecu-amber/10 text-amber-300';
  }
  if (status === 'FAILED' || status === 'REJECTED') {
    return 'border-ecu-red/25 bg-ecu-red/10 text-red-300';
  }
  return 'border-white/10 bg-white/5 text-brand-muted';
}

function moduleInfo(module: EcuPatcherModule): ModuleDisplay {
  return MODULES.find((item) => item.id === module) ?? MODULES[0];
}

function jobToTimelineState(status: EcuPatcherJobStatus): TimelineState {
  if (status === 'COMPLETED') return 'complete';
  if (status === 'FAILED' || status === 'REJECTED') return 'error';
  if (status === 'RUNNING' || status === 'QUEUED') return 'active';
  return 'idle';
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

  const selectFile = (nextFile: File | null) => {
    if (!nextFile) {
      setFile(null);
      setResult(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (
      !ACCEPTED_EXTENSIONS.includes(
        extensionOf(nextFile.name) as (typeof ACCEPTED_EXTENSIONS)[number]
      )
    ) {
      setError('Only .bin, .ori, and .hex ECU files are accepted.');
      setFile(null);
      setResult(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (nextFile.size <= 0) {
      setError('Uploaded ECU file cannot be empty.');
      setFile(null);
      setResult(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setFile(nextFile);
    setResult(null);
    setError(null);
  };

  const changeModule = (module: EcuPatcherModule) => {
    setActiveModule(module);
    setResult(null);
    setError(null);
  };

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
    <div className="bg-ecu-base text-brand-text">
      <Hero access={access} />

      <section id="patcher-workbench" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {!session && !isLoading ? (
          <SignedOutGate />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
            <ModuleSidebar
              access={access}
              activeModule={activeModule}
              changeModule={changeModule}
              jobs={jobs}
            />

            <main className="min-w-0 overflow-hidden rounded-lg border border-ecu-border bg-ecu-card shadow-brand-sm">
              {loadingState ? (
                <LoadingPanel />
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
                  selectFile={selectFile}
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

function Hero({ access }: { access: EcuPatcherAccess | null }) {
  const platformItems = [
    ['JWT session', 'Customer login restores the legacy license gate.'],
    ['Upload storage', 'Original BINs are stored through the platform upload pipeline.'],
    ['Job metadata', 'Status, hashes, patch counts, logs, and downloads are persisted.'],
    ['Isolated engine', 'Patch execution stays separate from shop and checkout flows.'],
  ];

  return (
    <section className="border-b border-ecu-border bg-[radial-gradient(circle_at_top_left,rgba(255,138,52,0.20),transparent_34%),linear-gradient(135deg,#0F1419,#071015)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8 lg:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-ecu-orange">
            ECU Patcher 2.0
          </p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-black leading-tight text-brand-text sm:text-5xl">
            Workshop patching experience connected to the real Caracal platform
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-brand-muted">
            The patcher interface is now adapted into the production route with customer auth,
            approved account access, server-side BIN upload, job status, result download, and
            account upload history.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#patcher-workbench"
              className="rounded-md bg-ecu-orange px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange"
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

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Modules" value="4" detail="Legacy suite" />
            <HeroMetric label="Access" value="1,200 AED" detail="One-time unlock" />
            <HeroMetric label="History" value="Account" detail="Uploads and jobs" />
          </div>
        </div>

        <div className="rounded-lg border border-ecu-border bg-black/25 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
                Platform status
              </p>
              <h2 className="mt-1 text-lg font-bold text-brand-text">Production wiring</h2>
            </div>
            <span
              className={cx('rounded-full border px-2.5 py-1 text-xs', statusClass(access?.status))}
            >
              {statusLabel(access?.status)}
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            {platformItems.map(([title, detail]) => (
              <div key={title} className="rounded-md border border-white/10 bg-ecu-hover/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-ecu-green" />
                  <strong className="text-sm text-brand-text">{title}</strong>
                </div>
                <p className="mt-1 text-xs leading-5 text-brand-muted">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-brand-muted">{label}</p>
      <strong className="mt-1 block text-xl text-brand-text">{value}</strong>
      <span className="mt-1 block text-xs text-brand-muted">{detail}</span>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-5 rounded-md border border-ecu-red/25 bg-ecu-red/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-red-200">Patcher action needs attention</p>
          <p className="mt-1 text-sm leading-6 text-red-100">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-red-300/20 px-2 py-1 text-xs font-bold text-red-100 hover:bg-red-500/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="grid gap-4 p-6">
      <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
      <div className="h-10 w-2/3 animate-pulse rounded bg-white/10" />
      <div className="h-36 animate-pulse rounded-lg bg-white/5" />
    </div>
  );
}

function SignedOutGate() {
  const features = [
    'Approved customer or dealer account',
    'Upload-backed job history',
    'Result download panel',
    'WhatsApp support fallback',
  ];

  return (
    <div className="grid gap-6 rounded-lg border border-ecu-border bg-ecu-card p-6 shadow-brand-sm lg:grid-cols-[1fr_340px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ecu-orange">
          Account required
        </p>
        <h2 className="mt-2 font-display text-3xl font-black text-brand-text">
          Sign in to unlock ECU Patcher 2.0
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
          The legacy PHP page used customer login and an admin-approved license. The new route keeps
          that commercial workflow while connecting it to JWT sessions and account upload history.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/login?returnTo=/ecu-patcher"
            className="rounded-md bg-ecu-orange px-4 py-2 text-sm font-bold text-white hover:bg-brand-orange"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-brand-text hover:bg-white/5"
          >
            Register
          </Link>
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
          Included workflow
        </p>
        <div className="mt-4 grid gap-3">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-sm text-brand-muted">
              <span className="mt-1 h-2 w-2 rounded-full bg-ecu-green" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleSidebar({
  access,
  activeModule,
  changeModule,
  jobs,
}: {
  access: EcuPatcherAccess | null;
  activeModule: EcuPatcherModule;
  changeModule: (module: EcuPatcherModule) => void;
  jobs: EcuPatcherJob[];
}) {
  return (
    <aside className="rounded-lg border border-ecu-border bg-ecu-card p-4 shadow-brand-sm lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand-muted">ECU Suite</p>
          <p className="mt-1 text-sm font-bold text-brand-text">Modules</p>
        </div>
        <span
          className={cx('rounded-full border px-2.5 py-1 text-xs', statusClass(access?.status))}
        >
          {statusLabel(access?.status)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
        {MODULES.map((module) => {
          const isActive = activeModule === module.id;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => changeModule(module.id)}
              className={cx(
                'rounded-md border px-3 py-3 text-left text-sm transition',
                isActive
                  ? 'border-ecu-orange bg-ecu-orange/10 text-brand-text'
                  : 'border-white/10 bg-black/20 text-brand-muted hover:border-white/20 hover:bg-ecu-hover'
              )}
            >
              <span className="flex items-center gap-2 font-bold">
                <span
                  className={cx('h-2 w-2 rounded-full', isActive ? 'bg-ecu-orange' : 'bg-white/25')}
                />
                {module.shortName}
              </span>
              <span className="mt-1 block text-xs">{module.family}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-md border border-white/10 bg-black/20 p-3 text-xs leading-5 text-brand-muted">
        <div className="flex items-center justify-between">
          <span>Recent jobs</span>
          <strong className="text-brand-text">{jobs.length}</strong>
        </div>
        <p className="mt-2">
          Original files are stored as platform upload records, so customers can recover history
          from their account.
        </p>
        <Link href="/account/uploads" className="mt-2 block font-bold text-ecu-orange">
          View account uploads
        </Link>
      </div>

      <SupportCard compact />
    </aside>
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
  const features = [
    ['DCM7.1b DPF-Off', '276 legacy patch entries and optional checksum marker.'],
    ['DCM7.1b EGR-Off', '75 legacy patch entries with external checksum verification.'],
    ['SID208 DPF+EGR', '79 legacy patch entries for supported PSA van ECUs.'],
    ['DTC remover', 'Legacy stride-2 DTC table candidate workflow.'],
  ];

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
          Patcher access
        </p>
        <h2 className="mt-2 font-display text-3xl font-black text-brand-text">
          One-time {formatMoney(access?.amountCents, access?.currency)} account unlock
        </h2>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          The legacy `patcher_licenses` gate is now backed by Prisma, JWT sessions, and audit logs.
          Request access, send payment proof on WhatsApp, and the workbench unlocks after admin
          approval.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {features.map(([title, detail]) => (
            <div key={title} className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-ecu-green" />
                <strong className="text-sm text-brand-text">{title}</strong>
              </div>
              <p className="mt-2 text-xs leading-5 text-brand-muted">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        {status === 'PENDING' ? (
          <StatusCard
            title="Request pending"
            tone="amber"
            message="Send payment proof on WhatsApp. Admin approval unlocks the workbench instantly."
            actionLabel="Send proof on WhatsApp"
            actionHref={WHATSAPP}
          />
        ) : status === 'REJECTED' ? (
          <StatusCard
            title="Access not approved"
            tone="red"
            message="Contact support to resolve payment or account verification before requesting again."
            actionLabel="Contact support"
            actionHref={WHATSAPP}
          />
        ) : (
          <>
            <label
              htmlFor="patcher-access-notes"
              className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted"
            >
              Notes for admin
            </label>
            <textarea
              id="patcher-access-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Vehicle, ECU family, payment method, or WhatsApp reference..."
              className="mt-2 min-h-32 w-full rounded-md border border-white/10 bg-ecu-base px-3 py-2 text-sm text-brand-text outline-none placeholder:text-brand-muted/60 focus:border-ecu-orange"
            />
            <button
              type="button"
              onClick={submitAccessRequest}
              disabled={busy}
              className="mt-3 w-full rounded-md bg-ecu-orange px-4 py-3 text-sm font-bold text-white hover:bg-brand-orange disabled:opacity-50"
            >
              {busy ? 'Submitting...' : 'Request access'}
            </button>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-center text-xs font-bold text-ecu-orange hover:text-brand-orange"
            >
              Ask for payment details on WhatsApp
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  title,
  tone,
  message,
  actionLabel,
  actionHref,
}: {
  title: string;
  tone: 'amber' | 'red';
  message: string;
  actionLabel: string;
  actionHref: string;
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-ecu-amber/30 bg-ecu-amber/10 text-amber-100'
      : 'border-ecu-red/30 bg-ecu-red/10 text-red-100';

  return (
    <div className={cx('rounded-md border p-4', toneClass)}>
      <p className="text-lg font-bold">{title}</p>
      <p className="mt-2 text-sm leading-6">{message}</p>
      <a
        href={actionHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded-md bg-ecu-orange px-4 py-2 text-center text-sm font-bold text-white hover:bg-brand-orange"
      >
        {actionLabel}
      </a>
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
  selectFile,
  setFixChecksum,
  submitPatchJob,
  downloadResult,
}: {
  active: ModuleDisplay;
  activeModule: EcuPatcherModule;
  busy: boolean;
  file: File | null;
  fixChecksum: boolean;
  inputRef: RefObject<HTMLInputElement>;
  jobs: EcuPatcherJob[];
  result: EcuPatcherJob | null;
  selectFile: (file: File | null) => void;
  setFixChecksum: (value: boolean) => void;
  submitPatchJob: () => void;
  downloadResult: (job: EcuPatcherJob) => void;
}) {
  const sizeWarning =
    file && active.expectedSize && file.size !== active.expectedSize
      ? `Expected ${active.expectedSize.toLocaleString()} bytes for ${active.shortName}. The API can still test the signature, but mismatches usually reject.`
      : null;

  return (
    <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-brand-muted">
              Module {MODULES.findIndex((item) => item.id === activeModule) + 1} / {active.family}
            </p>
            <h2 className="mt-1 font-display text-2xl font-black text-brand-text">{active.name}</h2>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{active.compatible}</p>
          </div>
          <span className="rounded-full border border-ecu-orange/25 bg-ecu-orange/10 px-3 py-1 text-xs font-bold text-ecu-orange">
            {active.patchCount}
          </span>
        </div>

        <div className="mt-6 grid gap-5">
          <FileDropZone
            active={active}
            busy={busy}
            file={file}
            inputRef={inputRef}
            selectFile={selectFile}
          />

          {sizeWarning && (
            <div className="rounded-md border border-ecu-amber/25 bg-ecu-amber/10 px-4 py-3 text-sm leading-6 text-amber-100">
              {sizeWarning}
            </div>
          )}

          <RequirementPanel active={active} />

          {activeModule === 'DCM71B_DPF' ? (
            <label className="flex items-start gap-3 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-brand-muted">
              <input
                type="checkbox"
                checked={fixChecksum}
                onChange={(event) => setFixChecksum(event.target.checked)}
                className="mt-1 h-4 w-4 accent-ecu-orange"
              />
              <span>
                <strong className="block text-brand-text">
                  Fix checksum marker after patching
                </strong>
                Writes the legacy verified marker used by the old DPF module. Uncheck if you prefer
                to patch only and verify in WinOLS.
              </span>
            </label>
          ) : (
            <div className="rounded-md border border-ecu-amber/25 bg-ecu-amber/10 p-4 text-sm leading-6 text-amber-100">
              {active.warning}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submitPatchJob}
              disabled={busy || !file}
              className="rounded-md bg-ecu-orange px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Processing...' : `Apply ${active.shortName}`}
            </button>
            <button
              type="button"
              onClick={() => selectFile(null)}
              disabled={busy || !file}
              className="rounded-md border border-white/15 px-5 py-3 text-sm font-bold text-brand-text hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear file
            </button>
          </div>
        </div>

        {result && <ResultPanel job={result} busy={busy} downloadResult={downloadResult} />}
      </div>

      <aside className="grid gap-5 border-t border-white/10 bg-black/20 p-5 xl:border-l xl:border-t-0">
        <TimelinePanel file={file} busy={busy} result={result} />
        <LiveLog busy={busy} result={result} />
        <RecentJobs jobs={jobs} busy={busy} downloadResult={downloadResult} />
        <SupportCard />
      </aside>
    </div>
  );
}

function FileDropZone({
  active,
  busy,
  file,
  inputRef,
  selectFile,
}: {
  active: ModuleDisplay;
  busy: boolean;
  file: File | null;
  inputRef: RefObject<HTMLInputElement>;
  selectFile: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (busy) return;
    selectFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.currentTarget.files?.[0] ?? null);
  };

  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-[0.18em] text-brand-muted">
        Input file
      </label>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !busy) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cx(
          'mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition',
          dragActive
            ? 'border-ecu-orange bg-ecu-orange/10'
            : 'border-white/15 bg-black/20 hover:border-ecu-orange/70',
          busy && 'cursor-not-allowed opacity-60'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".bin,.ori,.hex"
          className="hidden"
          onChange={handleFileInput}
        />
        <span className="rounded-full border border-white/10 bg-ecu-hover px-3 py-1 text-xs font-bold text-ecu-orange">
          {active.shortName}
        </span>
        <span className="mt-4 text-base font-bold text-brand-text">
          {file ? file.name : 'Drop .bin, .ori, or .hex here'}
        </span>
        <span className="mt-2 text-sm text-brand-muted">
          {file ? formatBytes(file.size) : 'Click to browse from your workstation'}
        </span>
      </div>
    </div>
  );
}

function RequirementPanel({ active }: { active: ModuleDisplay }) {
  const rows = [
    [
      'Expected size',
      active.expectedSize ? `${active.expectedSize.toLocaleString()} bytes` : 'Variable',
    ],
    ['Output suffix', active.output],
    ['Accepted files', ACCEPTED_EXTENSIONS.join(', ')],
    ['Engine source', active.engine],
  ];

  return (
    <div className="grid gap-3 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-brand-muted sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span className="block text-xs uppercase tracking-[0.14em]">{label}</span>
          <strong className="mt-1 block font-mono text-brand-text">{value}</strong>
        </div>
      ))}
      <div className="sm:col-span-2">
        <span className="block text-xs uppercase tracking-[0.14em]">Isolation</span>
        <p className="mt-1 text-brand-muted">
          Patcher jobs use `/api/ecu-patcher/jobs` and do not block storefront, checkout, or ECU
          corpus ingestion.
        </p>
      </div>
    </div>
  );
}

function TimelinePanel({
  file,
  busy,
  result,
}: {
  file: File | null;
  busy: boolean;
  result: EcuPatcherJob | null;
}) {
  const stages: Array<{ id: string; label: string; detail: string; state: TimelineState }> = [
    {
      id: 'access',
      label: 'Access approved',
      detail: 'Customer session and patcher approval are active.',
      state: 'complete',
    },
    {
      id: 'file',
      label: 'File selected',
      detail: file
        ? `${file.name} / ${formatBytes(file.size)}`
        : 'Waiting for a supported ECU file.',
      state: file ? 'complete' : 'idle',
    },
    {
      id: 'process',
      label: 'Upload and patch',
      detail: busy ? 'Uploading and running the isolated patch engine.' : 'Ready to process.',
      state: busy ? 'active' : result ? jobToTimelineState(result.status) : 'idle',
    },
    {
      id: 'result',
      label: 'Result storage',
      detail: result?.downloadUrl
        ? 'Patched result is stored and ready to download.'
        : result?.failure
          ? (result.failure.message ?? result.failure.code)
          : 'Result metadata appears here after processing.',
      state: result ? jobToTimelineState(result.status) : 'idle',
    },
  ];

  return (
    <div className="rounded-lg border border-white/10 bg-ecu-card p-4">
      <h3 className="font-display text-lg font-bold text-brand-text">Processing timeline</h3>
      <div className="mt-4 grid gap-3">
        {stages.map((stage) => (
          <div key={stage.id} className="flex gap-3">
            <span
              className={cx(
                'mt-1 h-3 w-3 rounded-full',
                stage.state === 'complete' && 'bg-ecu-green',
                stage.state === 'active' && 'animate-pulse bg-ecu-orange',
                stage.state === 'error' && 'bg-ecu-red',
                stage.state === 'idle' && 'bg-white/20'
              )}
            />
            <div>
              <p
                className={cx(
                  'text-sm font-bold',
                  stage.state === 'active' ? 'text-ecu-orange' : 'text-brand-text'
                )}
              >
                {stage.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-brand-muted">{stage.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveLog({ busy, result }: { busy: boolean; result: EcuPatcherJob | null }) {
  const logs = result?.logs ?? [];

  return (
    <div className="rounded-lg border border-white/10 bg-ecu-card p-4">
      <h3 className="font-display text-lg font-bold text-brand-text">Processing log</h3>
      <div className="mt-4 max-h-64 overflow-auto rounded-md border border-white/10 bg-[#05090d] p-3 font-mono text-xs leading-6">
        {logs.length === 0 ? (
          <div className="text-brand-muted">
            {busy ? 'Uploading to isolated patcher route...' : 'Ready. Select a file to begin.'}
          </div>
        ) : (
          logs.map((line, index) => (
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
          ))
        )}
        {busy && <div className="animate-pulse text-ecu-orange">Processing...</div>}
      </div>
    </div>
  );
}

function RecentJobs({
  jobs,
  busy,
  downloadResult,
}: {
  jobs: EcuPatcherJob[];
  busy: boolean;
  downloadResult: (job: EcuPatcherJob) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-white/10 bg-ecu-card p-4">
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
          jobs.slice(0, 6).map((job) => {
            const expanded = expandedId === job.id;
            return (
              <div key={job.id} className="rounded-md border border-white/10 bg-black/20">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : job.id)}
                  className="w-full p-3 text-left"
                >
                  <span
                    className={cx(
                      'rounded-full border px-2 py-0.5 text-[11px]',
                      statusClass(job.status)
                    )}
                  >
                    {job.status}
                  </span>
                  <strong className="mt-2 block truncate text-sm text-brand-text">
                    {job.originalFileName}
                  </strong>
                  <span className="mt-1 block text-xs text-brand-muted">
                    {moduleInfo(job.module).shortName} / {formatBytes(job.originalByteSize)}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-white/10 px-3 py-3 text-xs leading-5 text-brand-muted">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block uppercase tracking-[0.14em]">Created</span>
                        <strong className="mt-1 block text-brand-text">
                          {formatDate(job.createdAt)}
                        </strong>
                      </div>
                      <div>
                        <span className="block uppercase tracking-[0.14em]">Patches</span>
                        <strong className="mt-1 block text-brand-text">
                          {job.patches.applied}/{job.patches.total}
                        </strong>
                      </div>
                    </div>
                    {job.resultSha256 && (
                      <p className="mt-3 break-all font-mono text-brand-muted">
                        Result hash: {job.resultSha256}
                      </p>
                    )}
                    {job.downloadUrl && (
                      <button
                        type="button"
                        onClick={() => downloadResult(job)}
                        disabled={busy}
                        className="mt-3 w-full rounded-md bg-ecu-green px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Download result
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
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
          <span className={cx('rounded-full border px-2.5 py-1 text-xs', statusClass(job.status))}>
            {job.status}
          </span>
          <h3 className="mt-3 text-lg font-bold text-brand-text">
            {job.resultFileName ?? job.originalFileName}
          </h3>
          <p className="mt-1 text-sm leading-6 text-brand-muted">
            Applied {job.patches.applied} of {job.patches.total} patch entries. Result hash:{' '}
            <span className="font-mono">{job.resultSha256?.slice(0, 16) ?? 'n/a'}</span>
          </p>
        </div>
        {job.downloadUrl ? (
          <button
            type="button"
            onClick={() => downloadResult(job)}
            disabled={busy}
            className="rounded-md bg-ecu-green px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Download result
          </button>
        ) : (
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-white/15 px-4 py-2 text-sm font-bold text-brand-text hover:bg-white/5"
          >
            Ask support
          </a>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <ResultMetric label="Ready" value={job.patches.ready} />
        <ResultMetric label="Applied" value={job.patches.applied} />
        <ResultMetric label="Already" value={job.patches.alreadyApplied} />
        <ResultMetric label="Mismatched" value={job.patches.mismatched} />
      </div>

      {job.checksum.applied && (
        <div className="mt-4 rounded-md border border-ecu-green/20 bg-ecu-green/10 p-3 text-sm text-emerald-200">
          Checksum marker applied at {job.checksum.offset ?? 'n/a'} with value{' '}
          {job.checksum.value ?? 'n/a'}.
        </div>
      )}

      {job.failure && (
        <div className="mt-4 rounded-md border border-ecu-red/20 bg-ecu-red/10 p-3 text-sm text-red-200">
          {job.failure.message ?? job.failure.code}
        </div>
      )}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-ecu-hover/40 p-3">
      <span className="block text-xs uppercase tracking-[0.14em] text-brand-muted">{label}</span>
      <strong className="mt-1 block text-lg text-brand-text">{value.toLocaleString()}</strong>
    </div>
  );
}

function SupportCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cx('rounded-md border border-white/10 bg-black/20 p-3', !compact && 'p-4')}>
      <p className="text-sm font-bold text-brand-text">Need help?</p>
      <p className="mt-1 text-xs leading-5 text-brand-muted">
        If a file is rejected or the result needs manual review, send the job context to the
        workshop team.
      </p>
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-md bg-ecu-orange px-3 py-2 text-center text-xs font-bold text-white hover:bg-brand-orange"
      >
        WhatsApp support
      </a>
    </div>
  );
}
