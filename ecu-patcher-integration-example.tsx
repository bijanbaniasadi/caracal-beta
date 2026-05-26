/**
 * ECU Patcher 2.0 — Complete Integration Example
 * Shows how all components work together in a full application
 *
 * This example demonstrates:
 * - Main layout with module selector and upload panel
 * - Access gate flow for non-approved users
 * - Status/progress during patching
 * - Error handling
 * - Job history
 * - Responsive mobile/desktop layout
 */

import React, { useState, useEffect } from 'react';
import {
  PatcherLayout,
  UploadPanel,
  ModuleSelector,
  LiveLog,
  ActionButtons,
  AccessGate,
  type Module,
  type AccessStatus,
  type LogEntry,
} from './ecu-patcher-components';
import {
  ErrorPanel,
  ServiceCard,
  JobProgressTimeline,
  AccountHistory,
  SupportInfo,
  PricingTier,
  type TimelineStage,
  type Job,
  type Feature,
} from './ecu-patcher-additional-components';

/**
 * Mock data and configurations
 */
const MODULE_CONFIGS = {
  dpf: {
    id: 'dpf',
    name: 'DPF-Off',
    title: 'DPF Module Delete',
    meta: 'DCM7.1b — Boxer, Jumper, Relay, Ducato',
    fileSize: 6291456,
    suffix: '_dpf_patched.bin',
    checksumOpt: true,
    checksumInfo: '0xFACF5B2A (Viezu verified)',
  },
  egr: {
    id: 'egr',
    name: 'EGR-Off',
    title: 'EGR Module Delete',
    meta: 'DCM7.1b — Boxer, Jumper, Relay, Ducato',
    fileSize: 6291456,
    suffix: '_egr_patched.bin',
    checksumOpt: false,
    checksumInfo: 'Fix in WinOLS after patching',
  },
  sid208: {
    id: 'sid208',
    name: 'SID208',
    title: 'DPF + EGR Delete',
    meta: 'SID208 Peugeot/Citroen VAN ECU',
    fileSize: 4194304,
    suffix: '_sid208_patched.bin',
    checksumOpt: false,
    checksumInfo: 'Verify checksum with OBD tool',
  },
  dtc: {
    id: 'dtc',
    name: 'DTC Remover',
    title: 'Fault Code Scanner',
    meta: 'Universal — scan & remove DTC entries',
    fileSize: 0,
    suffix: '_dtc_clean.bin',
    checksumOpt: false,
  },
};

const PRICING_FEATURES: Feature[] = [
  {
    icon: '✓',
    label: 'DPF Delete (DCM7.1b)',
    description: '276 patches, Viezu verified checksum',
    included: true,
  },
  {
    icon: '✓',
    label: 'EGR Delete (DCM7.1b)',
    description: '75 patches, manual checksum fix',
    included: true,
  },
  {
    icon: '✓',
    label: 'DPF + EGR Delete (SID208)',
    description: '79 patches, universal support',
    included: true,
  },
  {
    icon: '✓',
    label: 'DTC Fault Code Remover',
    description: 'Heuristic scanning, interactive editor',
    included: true,
  },
  {
    icon: '✓',
    label: 'All Future Modules',
    description: 'Lifetime updates at no extra cost',
    included: true,
  },
  {
    icon: '✓',
    label: '100% Local Processing',
    description: 'No upload, offline in your browser',
    included: true,
  },
];

/**
 * Main ECU Patcher Application Component
 */
export const ECUPatcherApp: React.FC = () => {
  // Authentication & Access state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('approved');

  // UI state
  const [activeModule, setActiveModule] = useState<Module>('dpf');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Processing state
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<{
    type: string;
    title: string;
    message: string;
    details?: string;
  } | null>(null);
  const [canDownload, setCanDownload] = useState(false);

  // Job history
  const [jobHistory, setJobHistory] = useState<Job[]>([
    {
      id: '1',
      filename: 'boxer_dcm7_stock.bin',
      module: 'DPF-Off',
      date: '2026-05-24 14:32',
      size: '6.0 MB',
      status: 'success',
      checksum: '0xFACF5B2A',
    },
    {
      id: '2',
      filename: 'jumper_v2_original.bin',
      module: 'EGR-Off',
      date: '2026-05-23 10:15',
      size: '6.0 MB',
      status: 'success',
    },
  ]);

  // Simulate file processing
  const handleVerify = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setLogEntries([]);
    setProcessingStage('verify');

    // Simulate verification steps
    const steps = [
      { ts: '14:32:45', head: 'Loading', ok: `${selectedFile.name}` },
      { info: `Size: ${selectedFile.size.toLocaleString()} bytes` },
      { ts: '14:32:46', ok: `✓ File size valid (expected 6,291,456 bytes)` },
      { ts: '14:32:47', ok: `✓ Format: .bin (supported)` },
      { ts: '14:32:48', ok: `✓ Ready to patch (276 patches available)` },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 400));
      const key = Object.keys(step)[0] as keyof typeof step;
      setLogEntries((prev) => [
        ...prev,
        {
          type: key as any,
          text: (step as any)[key],
          timestamp: key === 'ts' ? (step as any)[key] : undefined,
        },
      ]);
    }

    setIsProcessing(false);
  };

  const handleApply = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setProcessingStage('apply');
    setCanDownload(false);

    // Simulate patching
    const steps = [
      { ts: '14:32:49', head: `Applying DPF-Off patch set…` },
      { info: `Patches: 276 total` },
      { ts: '14:32:50', warn: `⚠ Checksum will be recalculated` },
      { ts: '14:33:02', ok: `✓ Applied 276/276 patches` },
      { ts: '14:33:03', ok: `✓ Checksum: 0xFACF5B2A (Viezu verified)` },
      { ts: '14:33:04', head: `Done. Ready to download.` },
    ];

    for (const step of steps) {
      await new Promise((r) => setTimeout(r, 300));
      const key = Object.keys(step)[0] as keyof typeof step;
      setLogEntries((prev) => [
        ...prev,
        {
          type: key as any,
          text: (step as any)[key],
          timestamp: key === 'ts' ? (step as any)[key] : undefined,
        },
      ]);
    }

    setIsProcessing(false);
    setCanDownload(true);
    setProcessingStage(null);

    // Add to job history
    setJobHistory((prev) => [
      {
        id: Date.now().toString(),
        filename: selectedFile.name,
        module: 'DPF-Off',
        date: new Date().toLocaleString(),
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        status: 'success',
        checksum: '0xFACF5B2A',
      },
      ...prev,
    ]);
  };

  const handleDownload = () => {
    if (!selectedFile || !canDownload) return;
    // Trigger download of patched file
    alert(`Download: ${selectedFile.name.replace('.bin', '_patched.bin')}`);
  };

  const handleRequestAccess = () => {
    // Simulate access request
    setAccessStatus('pending');
  };

  // Conditional rendering based on access status
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-dark-base text-white p-4 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Hero section */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">ECU Patcher 2.0</h1>
            <p className="text-xl text-gray-400">Professional DPF/EGR deletion software for automotive workshops</p>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="card-lg text-center">
              <div className="text-orange-500 text-2xl mb-2">🔒</div>
              <h3 className="text-white font-semibold mb-1">100% Local</h3>
              <p className="text-gray-400 text-sm">No upload. Processing happens in your browser.</p>
            </div>
            <div className="card-lg text-center">
              <div className="text-green-500 text-2xl mb-2">✓</div>
              <h3 className="text-white font-semibold mb-1">Verified Patches</h3>
              <p className="text-gray-400 text-sm">Viezu-verified checksums for DPF module.</p>
            </div>
            <div className="card-lg text-center">
              <div className="text-blue-500 text-2xl mb-2">⚡</div>
              <h3 className="text-white font-semibold mb-1">Workshop Ready</h3>
              <p className="text-gray-400 text-sm">Professional interface. No marketing fluff.</p>
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Lifetime Access — One Price</h2>
            <div className="max-w-md mx-auto">
              <PricingTier
                price="1,200"
                currency="AED"
                period="One-time, lifetime access"
                features={PRICING_FEATURES}
                highlighted={true}
                cta={{
                  label: 'Sign In to Request Access',
                  onClick: () => setIsLoggedIn(true),
                }}
              />
            </div>
          </div>

          {/* Support info */}
          <div className="max-w-md mx-auto">
            <SupportInfo whatsappUrl="https://wa.me/971234567890" />
          </div>
        </div>
      </div>
    );
  }

  if (accessStatus !== 'approved') {
    return (
      <div className="min-h-screen bg-dark-base text-white p-4 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">ECU Patcher Access</h1>

          <AccessGate
            isLoggedIn={true}
            accessStatus={accessStatus}
            onRequestAccess={handleRequestAccess}
            whatsappUrl="https://wa.me/971234567890"
            loginUrl="/login"
            registerUrl="/register"
          />
        </div>
      </div>
    );
  }

  // Main patcher interface
  return (
    <div className="min-h-screen bg-dark-base text-white">
      <PatcherLayout
        activeModule={activeModule}
        onModuleChange={setActiveModule}
        accessStatus={accessStatus}
        isLoggedIn={isLoggedIn}
        whatsappUrl="https://wa.me/971234567890"
      >
        {error ? (
          <ErrorPanel
            type={error.type as any}
            title={error.title}
            message={error.message}
            details={error.details}
            onDismiss={() => setError(null)}
            recoveryAction={{
              label: 'Try Again',
              onClick: () => {
                setError(null);
                setSelectedFile(null);
              },
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Main content area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column - Upload */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-bold text-white mb-4">Upload & Process</h2>

                <UploadPanel
                  module={activeModule}
                  onFileSelect={(file) => {
                    setSelectedFile(file);
                    setLogEntries([]);
                    setCanDownload(false);
                  }}
                  selectedFile={selectedFile}
                  isProcessing={isProcessing}
                />

                {/* Action buttons */}
                <div className="mt-4">
                  <ActionButtons
                    onVerify={handleVerify}
                    onApply={handleApply}
                    onDownload={handleDownload}
                    isProcessing={isProcessing}
                    canDownload={canDownload}
                    module={activeModule}
                  />
                </div>

                {/* Processing log */}
                {logEntries.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-white font-semibold mb-2">Processing Log</h3>
                    <LiveLog entries={logEntries} isProcessing={isProcessing} />
                  </div>
                )}
              </div>

              {/* Right column - Sidebar info */}
              <div className="space-y-4">
                {/* Processing timeline (when active) */}
                {isProcessing && (
                  <JobProgressTimeline
                    stages={[
                      { id: 'load', label: 'Loading File', status: 'complete' },
                      {
                        id: 'verify',
                        label: 'Verifying',
                        status: processingStage === 'verify' ? 'active' : 'idle',
                      },
                      {
                        id: 'patch',
                        label: 'Applying Patches',
                        status: processingStage === 'apply' ? 'active' : 'idle',
                      },
                      {
                        id: 'checksum',
                        label: 'Checksum Verification',
                        status: canDownload ? 'complete' : 'idle',
                      },
                    ]}
                    currentStage={processingStage}
                    isProcessing={isProcessing}
                  />
                )}

                {/* Job history */}
                <AccountHistory jobs={jobHistory} maxDisplay={3} />

                {/* Support widget */}
                <SupportInfo whatsappUrl="https://wa.me/971234567890" showCompact={false} />
              </div>
            </div>

            {/* Service cards section (module selector when not in sidebar) */}
            <div className="lg:hidden mt-8">
              <h3 className="text-lg font-bold text-white mb-4">Available Modules</h3>
              <div className="grid grid-cols-1 gap-4">
                {Object.values(MODULE_CONFIGS).map((config) => (
                  <ServiceCard
                    key={config.id}
                    title={config.title}
                    vehicleModels={['Boxer', 'Jumper', 'Relay']}
                    patches={276}
                    fileSize={`${(config.fileSize / 1024 / 1024).toFixed(1)} MB`}
                    checksum={{
                      verified: config.checksumOpt,
                      value: config.checksumInfo,
                    }}
                    onClick={() => setActiveModule(config.id as Module)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </PatcherLayout>
    </div>
  );
};

export default ECUPatcherApp;
