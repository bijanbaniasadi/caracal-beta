import React, { useState } from 'react';
import { ChevronDown, AlertCircle, Zap, Clock, CheckCircle, Download } from 'lucide-react';

/**
 * Error/Fallback Panel Component
 * Displays error states with recovery options
 */
export interface ErrorPanelProps {
  type: 'file-size' | 'file-format' | 'checksum-mismatch' | 'processing-error' | 'browser-support';
  title: string;
  message: string;
  details?: string;
  recoveryAction?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

export const ErrorPanel: React.FC<ErrorPanelProps> = ({
  type,
  title,
  message,
  details,
  recoveryAction,
  onDismiss,
}) => {
  const iconColor = 'text-red-500';
  const borderColor = 'border-l-red-500';
  const bgColor = 'bg-red-500 bg-opacity-10';

  return (
    <div className={`${borderColor} ${bgColor} border-l-4 rounded-r p-4 flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <AlertCircle className={`${iconColor} w-5 h-5 flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <h3 className="text-red-400 font-semibold text-base">{title}</h3>
          <p className="text-gray-300 text-sm mt-1">{message}</p>
          {details && (
            <details className="mt-2">
              <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
                Technical details
              </summary>
              <pre className="mt-2 bg-dark-base rounded p-2 text-xs text-gray-400 overflow-x-auto font-mono">
                {details}
              </pre>
            </details>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>

      {recoveryAction && (
        <div className="flex gap-2">
          <button
            onClick={recoveryAction.onClick}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
          >
            {recoveryAction.label}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 bg-dark-hover hover:bg-dark-card text-gray-300 rounded text-sm font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Service/Module Card Component
 * Displays supported ECU module with specs and action
 */
export interface ServiceCardProps {
  title: string;
  vehicleModels: string[];
  patches: number;
  fileSize: string;
  checksum?: {
    verified: boolean;
    value?: string;
    note?: string;
  };
  icon?: React.ReactNode;
  isComingSoon?: boolean;
  onClick?: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  vehicleModels,
  patches,
  fileSize,
  checksum,
  icon = <Zap className="w-6 h-6" />,
  isComingSoon = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isComingSoon}
      className={`
        card group flex flex-col gap-4 cursor-pointer
        transition-all duration-200
        ${
          isComingSoon
            ? 'opacity-50 cursor-not-allowed hover:shadow-sm'
            : 'hover:shadow-md hover:border-orange-500 hover:bg-dark-hover active:bg-dark-card'
        }
      `}
    >
      {/* Header with icon */}
      <div className="flex items-start justify-between gap-3">
        <div className={`text-orange-500 group-hover:scale-110 transition-transform ${isComingSoon ? 'opacity-50' : ''}`}>
          {icon}
        </div>
        {isComingSoon && (
          <span className="badge badge-warning text-xs">Coming Soon</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-white font-bold text-lg text-left">{title}</h3>

      {/* Vehicle models */}
      <div>
        <p className="text-text-label text-xs">Compatible Vehicles</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {vehicleModels.map((model) => (
            <span
              key={model}
              className="px-2 py-1 bg-dark-hover rounded text-gray-300 text-xs font-mono"
            >
              {model}
            </span>
          ))}
        </div>
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-dark-border">
        <div>
          <p className="text-text-label">Patches</p>
          <p className="text-white font-semibold text-lg mt-0.5">{patches.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-text-label">File Size</p>
          <p className="text-white font-semibold text-lg mt-0.5">{fileSize}</p>
        </div>
      </div>

      {/* Checksum info */}
      {checksum && (
        <div className={`
          border-l-4 rounded-r px-3 py-2
          ${checksum.verified
            ? 'border-green-500 bg-green-500 bg-opacity-10'
            : 'border-amber-500 bg-amber-500 bg-opacity-10'
          }
        `}>
          <div className="flex items-center gap-2">
            {checksum.verified ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            )}
            <div className="text-xs">
              <p className={checksum.verified ? 'text-green-400' : 'text-amber-400'} className="font-semibold">
                {checksum.verified ? 'Verified Checksum' : 'No Verified Checksum'}
              </p>
              {checksum.value && (
                <p className="text-gray-400 font-mono text-xs mt-0.5">{checksum.value}</p>
              )}
              {checksum.note && (
                <p className="text-gray-400 text-xs mt-1">{checksum.note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <button
        className={`
          mt-2 w-full py-2 px-3 rounded font-medium text-sm
          transition-all duration-200
          ${
            isComingSoon
              ? 'bg-dark-hover text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
          }
        `}
      >
        {isComingSoon ? 'Coming Soon' : 'Select Module'}
      </button>
    </button>
  );
};

/**
 * Job Progress Timeline Component
 * Visual timeline showing patching process stages
 */
export interface TimelineStage {
  id: string;
  label: string;
  status: 'idle' | 'active' | 'complete' | 'error';
  timestamp?: string;
  details?: string;
}

export interface JobProgressTimelineProps {
  stages: TimelineStage[];
  currentStage?: string;
  isProcessing: boolean;
}

export const JobProgressTimeline: React.FC<JobProgressTimelineProps> = ({
  stages,
  currentStage,
  isProcessing,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'bg-green-500';
      case 'active':
        return 'bg-orange-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'active':
        return '●';
      case 'error':
        return '!';
      default:
        return '○';
    }
  };

  return (
    <div className="card-lg">
      <h3 className="text-white font-semibold text-base mb-4">Processing Timeline</h3>

      <div className="space-y-3">
        {stages.map((stage, index) => {
          const isActive = currentStage === stage.id;
          const isComplete = !stages.slice(index).some((s) => s.status !== 'complete' && s.status !== 'idle');

          return (
            <div key={stage.id} className="flex gap-4">
              {/* Timeline dot and line */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center
                    text-white text-xs font-bold transition-all
                    ${getStatusColor(stage.status)}
                    ${isActive && isProcessing ? 'animate-pulse' : ''}
                  `}
                >
                  {getStatusIcon(stage.status)}
                </div>
                {index < stages.length - 1 && (
                  <div
                    className={`
                      w-0.5 h-12 mt-2
                      transition-colors
                      ${
                        stage.status === 'complete' || stage.status === 'active'
                          ? 'bg-orange-500'
                          : 'bg-gray-700'
                      }
                    `}
                  />
                )}
              </div>

              {/* Stage content */}
              <div className="flex-1 py-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${isActive ? 'text-orange-500' : 'text-white'}`}>
                    {stage.label}
                  </p>
                  {stage.timestamp && (
                    <p className="text-gray-500 text-xs">{stage.timestamp}</p>
                  )}
                </div>
                {stage.details && (
                  <p className="text-gray-400 text-sm mt-1">{stage.details}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Account History / Job List Component
 * Shows previous patching jobs and quick access
 */
export interface Job {
  id: string;
  filename: string;
  module: string;
  date: string;
  size: string;
  status: 'success' | 'failed' | 'pending';
  checksum?: string;
}

export interface AccountHistoryProps {
  jobs: Job[];
  onJobSelect?: (jobId: string) => void;
  onViewAll?: () => void;
  maxDisplay?: number;
}

export const AccountHistory: React.FC<AccountHistoryProps> = ({
  jobs,
  onJobSelect,
  onViewAll,
  maxDisplay = 5,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayJobs = jobs.slice(0, maxDisplay);
  const hasMore = jobs.length > maxDisplay;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="badge badge-success">Completed</span>;
      case 'failed':
        return <span className="badge badge-danger">Failed</span>;
      case 'pending':
        return <span className="badge badge-warning">Processing</span>;
      default:
        return null;
    }
  };

  return (
    <div className="card-lg">
      <h3 className="text-white font-semibold text-base mb-4">Recent Jobs</h3>

      {jobs.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No jobs yet. Upload your first file to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayJobs.map((job) => (
            <div key={job.id} className="border border-dark-border rounded hover:bg-dark-hover transition-colors">
              <button
                onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                className="w-full px-3 py-3 text-left flex items-center gap-3 group"
              >
                {/* Status indicator */}
                <div
                  className={`
                    w-2 h-2 rounded-full flex-shrink-0
                    ${
                      job.status === 'success'
                        ? 'bg-green-500'
                        : job.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                    }
                  `}
                />

                {/* Job info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium truncate text-sm">{job.filename}</p>
                    <span className="text-gray-500 text-xs">{job.module}</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{job.date}</p>
                </div>

                {/* Status badge and expand */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(job.status)}
                  <ChevronDown
                    className={`
                      w-4 h-4 text-gray-500 transition-transform
                      ${expandedId === job.id ? 'rotate-180' : ''}
                    `}
                  />
                </div>
              </button>

              {/* Expanded details */}
              {expandedId === job.id && (
                <div className="border-t border-dark-border px-3 py-3 bg-dark-hover bg-opacity-50">
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-text-label">File Size</p>
                      <p className="text-white font-mono mt-1">{job.size}</p>
                    </div>
                    <div>
                      <p className="text-text-label">Status</p>
                      <p className="text-white font-medium mt-1">
                        {job.status === 'success'
                          ? 'Ready to Download'
                          : job.status === 'failed'
                            ? 'Processing Failed'
                            : 'Still Processing'}
                      </p>
                    </div>
                  </div>

                  {job.checksum && (
                    <div className="mb-3">
                      <p className="text-text-label text-xs">Checksum (CRC32)</p>
                      <p className="text-gray-300 font-mono text-xs mt-1">{job.checksum}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {job.status === 'success' && (
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                    {job.status === 'failed' && (
                      <button className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-medium transition-colors">
                        Retry
                      </button>
                    )}
                    <button
                      className="flex-1 px-3 py-2 bg-dark-border hover:bg-dark-hover text-gray-300 rounded text-sm font-medium transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={onViewAll}
              className="w-full px-3 py-2 text-orange-500 hover:text-orange-400 text-sm font-medium transition-colors text-center"
            >
              View all {jobs.length} jobs →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Support Info Card Component
 * Quick support/help widget with contact options
 */
export interface SupportInfoProps {
  whatsappUrl: string;
  email?: string;
  responseTime?: string;
  showCompact?: boolean;
}

export const SupportInfo: React.FC<SupportInfoProps> = ({
  whatsappUrl,
  email = 'support@caracaltech.com',
  responseTime = 'Usually within a few hours',
  showCompact = false,
}) => {
  if (showCompact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <Clock className="w-4 h-4 text-gray-500" />
        <p className="text-gray-400">{responseTime}</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <h4 className="text-white font-semibold">Need Help?</h4>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
      >
        <span>💬</span>
        WhatsApp Support
      </a>

      <div className="text-xs text-gray-400 border-t border-dark-border pt-3">
        <p className="font-medium text-gray-300 mb-1">Email</p>
        <a href={`mailto:${email}`} className="link text-xs">
          {email}
        </a>
        <p className="mt-2">{responseTime}</p>
      </div>
    </div>
  );
};

/**
 * Pricing Tier / Feature List Component
 * Displays what's included in access
 */
export interface Feature {
  icon: React.ReactNode;
  label: string;
  description?: string;
  included: boolean;
}

export interface PricingTierProps {
  price: string;
  currency: string;
  period: string;
  features: Feature[];
  highlighted?: boolean;
  cta?: {
    label: string;
    onClick: () => void;
  };
}

export const PricingTier: React.FC<PricingTierProps> = ({
  price,
  currency,
  period,
  features,
  highlighted = false,
  cta,
}) => {
  return (
    <div
      className={`
        card-lg flex flex-col gap-4
        ${highlighted ? 'border-2 border-orange-500 bg-dark-card' : ''}
      `}
    >
      {/* Price header */}
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-orange-500">{price}</span>
          <span className="text-gray-400">{currency}</span>
        </div>
        <p className="text-gray-400 text-sm mt-1">{period}</p>
      </div>

      {/* Features list */}
      <div className="space-y-2 flex-1">
        {features.map((feature, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-2 ${feature.included ? 'opacity-100' : 'opacity-50'}`}
          >
            <div className="text-green-500 flex-shrink-0 mt-0.5">
              {feature.included ? '✓' : '✗'}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">{feature.label}</p>
              {feature.description && (
                <p className="text-gray-500 text-xs mt-0.5">{feature.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA button */}
      {cta && (
        <button
          onClick={cta.onClick}
          className="w-full py-2 px-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded font-medium text-sm transition-colors mt-4"
        >
          {cta.label}
        </button>
      )}
    </div>
  );
};
