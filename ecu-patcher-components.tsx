/**
 * ECU Patcher 2.0 — React Components
 * Frontend-only, integrated with legacy PHP/CSRF
 *
 * Tailwind: dark automotive theme
 * No backend changes
 */

import React, { useState, useRef, useEffect } from 'react';

/* ════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ════════════════════════════════════════════════════════════════════ */

type Module = 'dpf' | 'egr' | 'sid208' | 'dtc';
type AccessStatus = null | 'pending' | 'approved' | 'rejected';
type LogLevel = 'ts' | 'head' | 'ok' | 'warn' | 'err' | 'info';

interface ModuleConfig {
  id: Module;
  name: string;
  title: string;
  meta: string;
  fileSize: number;
  suffix: string;
  checksumOpt: boolean;
  checksumInfo?: string;
}

const MODULES: Record<Module, ModuleConfig> = {
  dpf: {
    id: 'dpf',
    name: 'DPF-Off',
    title: 'PSA Delphi DCM7.1b',
    meta: 'Boxer · Jumper · Relay 2.2 HDi · Viezu · 276 patches',
    fileSize: 6291456,
    suffix: '_DPF_off',
    checksumOpt: true,
    checksumInfo: 'Fix checksum after patching (writes 0xFACF5B2A — Viezu verified)',
  },
  egr: {
    id: 'egr',
    name: 'EGR-Off',
    title: 'PSA Delphi DCM7.1b',
    meta: 'Boxer · Jumper · Relay 2.2 HDi · TUNERPAD · 75 patches',
    fileSize: 6291456,
    suffix: '_EGR_off',
    checksumOpt: false,
    checksumInfo: 'No verified checksum for EGR-Off — patch only. Fix checksum in WinOLS after applying.',
  },
  sid208: {
    id: 'sid208',
    name: 'DPF+EGR Off',
    title: 'PSA Siemens SID208',
    meta: 'Boxer · Jumper · Relay 2.2 HDi · DaVinci · 79 patches',
    fileSize: 4194304,
    suffix: '_DPF_EGR_off',
    checksumOpt: false,
    checksumInfo: 'No verified checksum for DPF+EGR-Off — patch only. Fix in WinOLS. Expected size: 4,194,304 bytes.',
  },
  dtc: {
    id: 'dtc',
    name: 'DTC Remover',
    title: 'Universal ECU DTC Scanner',
    meta: 'Universal ECU DTC scanner · stride-2 heuristic',
    fileSize: 0, // Variable
    suffix: '_DTC_patched',
    checksumOpt: false,
  },
};

/* ════════════════════════════════════════════════════════════════════
   1. UPLOAD PANEL COMPONENT
   ════════════════════════════════════════════════════════════════════ */

interface UploadPanelProps {
  module: Module;
  onFileSelect: (file: File) => void;
  selectedFile?: File;
  isProcessing: boolean;
}

export function UploadPanel({ module, onFileSelect, selectedFile, isProcessing }: UploadPanelProps) {
  const cfg = MODULES[module];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="space-y-4">
      {/* File Input (Drag & Drop) */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
          Input File
        </label>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-150
            ${
              dragActive
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
            }
          `}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".bin,.ori,.hex"
            onChange={handleFileInput}
            className="hidden"
          />
          {selectedFile ? (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-100">{selectedFile.name}</div>
              <div className="text-xs text-slate-400">
                {(selectedFile.size / 1048576).toFixed(2)} MB
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileSelect(null as any);
                }}
                className="mt-2 text-xs text-orange-500 hover:text-orange-400 font-medium"
              >
                Change file
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <svg
                className="mx-auto h-8 w-8 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <div className="text-sm text-slate-300">
                Drop <span className="font-mono text-orange-500">.bin / .ori / .hex</span> here or click to browse
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Requirements Card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-7-4a1 1 0 11-2 0 1 1 0 012 0z"
              clipRule="evenodd"
            />
          </svg>
          Requirements
        </div>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Module:</span>
            <span className="text-slate-300 font-mono">{cfg.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Expected Size:</span>
            <span className="text-slate-300 font-mono">{cfg.fileSize.toLocaleString()} bytes</span>
          </div>
          <div className="flex justify-between">
            <span>Format:</span>
            <span className="text-slate-300 font-mono">.bin, .ori, .hex</span>
          </div>
          <div className="pt-2 border-t border-slate-800 text-slate-300 flex items-start gap-2">
            <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
            <span>Your file never leaves your browser — 100% local processing</span>
          </div>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
          Options
        </label>
        {cfg.checksumOpt ? (
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              defaultChecked
              className="mt-1 w-4 h-4 accent-orange-500 rounded"
            />
            <div className="flex-1">
              <span className="text-sm text-slate-300">{cfg.checksumInfo}</span>
              <div className="text-xs text-slate-500 mt-1">
                Uncheck to patch only. Fix checksum later in WinOLS if needed.
              </div>
            </div>
          </label>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex gap-2 items-start">
              <span className="text-amber-500 flex-shrink-0 text-sm">⚠</span>
              <span className="text-sm text-amber-100">{cfg.checksumInfo}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   2. MODULE SELECTOR (Desktop Sidebar)
   ════════════════════════════════════════════════════════════════════ */

interface ModuleSelectorProps {
  activeModule: Module;
  onModuleChange: (module: Module) => void;
  accessStatus: AccessStatus;
  whatsappUrl: string;
}

export function ModuleSelector({
  activeModule,
  onModuleChange,
  accessStatus,
  whatsappUrl,
}: ModuleSelectorProps) {
  const modules: Module[] = ['dpf', 'egr', 'sid208', 'dtc'];

  return (
    <div className="hidden lg:flex flex-col w-64 bg-slate-950/50 border-r border-slate-800 py-6">
      {/* Logo */}
      <div className="px-6 pb-6 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CT</span>
          </div>
          <div className="font-display font-bold text-xs text-slate-100 tracking-widest">
            ECU SUITE
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="flex-1 space-y-1 px-3">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-600 px-3 py-2 mb-2">
          ECU Modules
        </div>
        {modules.map((mod) => {
          const cfg = MODULES[mod];
          const isActive = mod === activeModule;
          return (
            <button
              key={mod}
              onClick={() => {
                if (accessStatus === 'approved') onModuleChange(mod);
              }}
              disabled={accessStatus !== 'approved'}
              className={`
                w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
                flex items-center gap-2
                ${
                  isActive
                    ? 'bg-orange-500/15 text-orange-500 border-l-2 border-l-orange-500'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
                }
                ${accessStatus !== 'approved' && 'opacity-50 cursor-not-allowed'}
              `}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
              <div className="flex-1 text-xs">
                <div>{cfg.title}</div>
                <div className="text-slate-500 font-mono text-10px">{cfg.name}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 pt-4 border-t border-slate-800/50">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          Need help? WhatsApp us
        </a>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   3. LIVE LOG COMPONENT
   ════════════════════════════════════════════════════════════════════ */

interface LogEntry {
  type: LogLevel;
  text: string;
  timestamp?: string;
}

interface LiveLogProps {
  entries: LogEntry[];
  isProcessing: boolean;
}

export function LiveLog({ entries, isProcessing }: LiveLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries]);

  const getLogClass = (type: LogLevel): string => {
    const base = 'text-xs font-mono';
    switch (type) {
      case 'ts':
        return `${base} text-slate-600`;
      case 'head':
        return `${base} font-bold text-slate-300`;
      case 'ok':
        return `${base} text-green-400 font-semibold`;
      case 'warn':
        return `${base} text-amber-400 font-semibold`;
      case 'err':
        return `${base} text-red-400 font-semibold`;
      case 'info':
        return `${base} text-slate-400`;
      default:
        return base;
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Processing Log
      </label>
      <div
        ref={logRef}
        className="
          bg-slate-950 border border-slate-800 rounded-lg p-3
          font-mono text-xs leading-relaxed overflow-y-auto
          max-h-64 lg:max-h-80
        "
      >
        {entries.length === 0 ? (
          <div className="text-slate-500">Ready. Select a file to begin.</div>
        ) : (
          <div className="space-y-0">
            {entries.map((entry, i) => (
              <div key={i} className={getLogClass(entry.type)}>
                {entry.timestamp && <span className="text-slate-700">[{entry.timestamp}] </span>}
                {entry.text}
              </div>
            ))}
            {isProcessing && (
              <div className="text-slate-600 animate-pulse">Processing…</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   4. ACTION BUTTONS ROW
   ════════════════════════════════════════════════════════════════════ */

interface ActionButtonsProps {
  onVerify: () => void;
  onApply: () => void;
  onDownload?: () => void;
  isProcessing: boolean;
  canDownload: boolean;
  module: Module;
}

export function ActionButtons({
  onVerify,
  onApply,
  onDownload,
  isProcessing,
  canDownload,
  module,
}: ActionButtonsProps) {
  const moduleName = MODULES[module].name;

  return (
    <div className="flex flex-col sm:flex-row gap-3 pt-4">
      <button
        onClick={onVerify}
        disabled={isProcessing}
        className={`
          px-6 py-2 rounded-lg font-semibold text-sm transition-colors
          ${
            isProcessing
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-900'
          }
        `}
      >
        Verify File
      </button>

      <button
        onClick={onApply}
        disabled={isProcessing}
        className={`
          px-6 py-2 rounded-lg font-semibold text-sm transition-colors flex-1 sm:flex-none
          ${
            isProcessing
              ? 'bg-orange-600/50 text-slate-400 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
          }
        `}
      >
        Apply {moduleName}
      </button>

      {canDownload && onDownload && (
        <button
          onClick={onDownload}
          className="
            px-6 py-2 rounded-lg font-semibold text-sm transition-colors
            bg-green-500/20 text-green-400 border border-green-500/30
            hover:bg-green-500/30 active:bg-green-500/40
          "
        >
          ↓ Download File
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   5. ACCESS GATE (Premium Pricing)
   ════════════════════════════════════════════════════════════════════ */

interface AccessGateProps {
  isLoggedIn: boolean;
  accessStatus: AccessStatus;
  onRequestAccess: (notes: string) => Promise<void>;
  whatsappUrl: string;
  loginUrl: string;
  registerUrl: string;
}

export function AccessGate({
  isLoggedIn,
  accessStatus,
  onRequestAccess,
  whatsappUrl,
  loginUrl,
  registerUrl,
}: AccessGateProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onRequestAccess(notes);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-2xl lg:text-3xl font-display font-bold text-slate-100 mb-2">
            ECU Patcher Suite — Access Required
          </h2>
          <p className="text-slate-400">One-time payment unlocks all current and future patcher modules for your account.</p>
        </div>

        {/* Grid: Price + Features vs Request Form */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Price & Features */}
          <div>
            <div className="mb-8">
              <div className="text-5xl font-display font-black text-orange-500 mb-1">
                1,200 <span className="text-2xl font-bold">AED</span>
              </div>
              <div className="text-xs uppercase tracking-widest text-slate-500">
                One-time · Account lifetime access
              </div>
            </div>

            <ul className="space-y-3">
              {[
                { title: 'DPF Delete', desc: 'Boxer · Jumper · Relay · Ducato 2.2 HDi (DCM7.1b · 276 patches)' },
                { title: 'EGR Delete', desc: 'Boxer · Jumper · Relay · Ducato 2.2 HDi (DCM7.1b · 75 patches)' },
                { title: 'DPF + EGR Delete', desc: 'Boxer · Jumper · Relay 2.2 HDi (SID208 · 79 patches)' },
                { title: 'DTC Fault Code Remover', desc: 'Universal, any ECU binary' },
                { title: 'Future modules included', desc: 'All new vehicle modules at no extra cost' },
                { title: '100% private', desc: 'Your file never leaves your browser' },
              ].map((feature, i) => (
                <li key={i} className="flex gap-3 items-start text-sm">
                  <span className="text-orange-500 font-bold flex-shrink-0 mt-0.5">✓</span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-200">{feature.title}</div>
                    <div className="text-xs text-slate-500">{feature.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Request Form or Status */}
          <div>
            {!isLoggedIn ? (
              // Not logged in
              <div className="space-y-4">
                <div className="space-y-2 bg-slate-900/50 border border-slate-800 rounded-lg p-4">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex gap-3 items-start text-sm">
                      <div className="w-6 h-6 rounded-full bg-orange-500/15 text-orange-500 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                        {step}
                      </div>
                      <div className="text-slate-300 pt-0.5">
                        {step === 1 && 'Sign in to your CaracalTech account'}
                        {step === 2 && 'Submit a patcher access request'}
                        {step === 3 && 'Transfer 1,200 AED & send proof via WhatsApp'}
                        {step === 4 && 'Admin confirms — tool unlocks instantly'}
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  href={loginUrl}
                  className="block w-full px-4 py-3 bg-orange-500 text-white font-bold rounded-lg text-center hover:bg-orange-600 transition-colors"
                >
                  ➜ Sign In to Request Access
                </a>
                <a
                  href={registerUrl}
                  className="block w-full px-4 py-2 bg-slate-800 text-slate-200 font-semibold rounded-lg text-center text-sm hover:bg-slate-700 transition-colors"
                >
                  No account? Register here
                </a>
              </div>
            ) : accessStatus === 'pending' ? (
              // Pending
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6 space-y-4">
                <div className="text-3xl">⏱</div>
                <div>
                  <h3 className="font-bold text-amber-200 mb-2">Request Submitted — Awaiting Confirmation</h3>
                  <p className="text-sm text-amber-100">
                    Your request is in the queue. Transfer 1,200 AED and send the payment screenshot via WhatsApp.
                    Admin will approve your access — usually within a few hours.
                  </p>
                </div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 bg-green-600 text-white font-bold rounded-lg text-center hover:bg-green-700 transition-colors"
                >
                  💬 Send Payment Proof on WhatsApp
                </a>
              </div>
            ) : accessStatus === 'rejected' ? (
              // Rejected
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 space-y-4">
                <div className="text-3xl">✗</div>
                <div>
                  <h3 className="font-bold text-red-200 mb-2">Access Request Not Approved</h3>
                  <p className="text-sm text-red-100">
                    Your request was not approved. Contact us via WhatsApp for details or to resolve any payment issues.
                  </p>
                </div>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 bg-orange-500 text-white font-bold rounded-lg text-center hover:bg-orange-600 transition-colors"
                >
                  Contact Us on WhatsApp
                </a>
              </div>
            ) : (
              // Logged in, no request — show form
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 bg-slate-900/50 border border-slate-800 rounded-lg p-4">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex gap-3 items-start text-sm">
                      <div className="w-6 h-6 rounded-full bg-orange-500/15 text-orange-500 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                        {step}
                      </div>
                      <div className="text-slate-300 pt-0.5">
                        {step === 1 && 'Submit your request below'}
                        {step === 2 && 'Transfer 1,200 AED (details via WhatsApp)'}
                        {step === 3 && 'Send payment screenshot via WhatsApp'}
                        {step === 4 && 'Admin approves — tool unlocks within hours'}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Notes for admin (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. vehicle details, payment method, or any other notes…"
                    className="
                      w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg
                      text-sm text-slate-100 placeholder-slate-600
                      focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500
                    "
                    rows={3}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`
                    w-full px-4 py-3 rounded-lg font-bold transition-colors
                    ${
                      isSubmitting
                        ? 'bg-orange-600/50 text-slate-400 cursor-not-allowed'
                        : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
                    }
                  `}
                >
                  🔓 Request Access — 1,200 AED
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   6. MAIN PATCHER LAYOUT
   ════════════════════════════════════════════════════════════════════ */

interface PatcherLayoutProps {
  activeModule: Module;
  onModuleChange: (module: Module) => void;
  accessStatus: AccessStatus;
  isLoggedIn: boolean;
  children: React.ReactNode;
  whatsappUrl: string;
}

export function PatcherLayout({
  activeModule,
  onModuleChange,
  accessStatus,
  isLoggedIn,
  children,
  whatsappUrl,
}: PatcherLayoutProps) {
  const isApproved = accessStatus === 'approved';

  if (!isApproved) {
    return (
      <AccessGate
        isLoggedIn={isLoggedIn}
        accessStatus={accessStatus}
        onRequestAccess={async () => {}} // Pass actual handler from parent
        whatsappUrl={whatsappUrl}
        loginUrl="/login"
        registerUrl="/register"
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-screen bg-slate-950">
      {/* Mobile Tab Navigation */}
      <div className="lg:hidden border-b border-slate-800 overflow-x-auto">
        <div className="flex gap-0">
          {(['dpf', 'egr', 'sid208', 'dtc'] as Module[]).map((mod) => {
            const cfg = MODULES[mod];
            const isActive = mod === activeModule;
            return (
              <button
                key={mod}
                onClick={() => onModuleChange(mod)}
                className={`
                  px-4 py-3 font-medium text-sm border-b-2 whitespace-nowrap
                  ${
                    isActive
                      ? 'border-orange-500 text-orange-500'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }
                `}
              >
                {cfg.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar (Desktop) */}
      <ModuleSelector
        activeModule={activeModule}
        onModuleChange={onModuleChange}
        accessStatus={accessStatus}
        whatsappUrl={whatsappUrl}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-8 py-6 max-w-5xl">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Module {['dpf', 'egr', 'sid208', 'dtc'].indexOf(activeModule) + 1}</span>
                <span className="opacity-50">/</span>
                <span>{MODULES[activeModule].title}</span>
                <span className="opacity-50">/</span>
                <span className="text-orange-500 font-semibold">{MODULES[activeModule].name}</span>
              </div>
              <div className="hidden sm:block text-xs text-slate-600">
                {MODULES[activeModule].meta}
              </div>
            </div>

            {children}
          </div>
        </div>

        {/* Status Bar (Desktop) */}
        <div className="hidden lg:flex border-t border-slate-800 px-8 py-3 text-xs text-slate-500 justify-between items-center bg-slate-900/30">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Ready
          </div>
          <span className="text-slate-700">CaracalTech ECU Suite v1.0</span>
        </div>
      </div>
    </div>
  );
}

export default PatcherLayout;
