'use client';

import { useAdminDashboard } from '@/hooks/queries/use-admin-dashboard';
import { useAdminIntake } from '@/hooks/queries/use-admin-intake';
import { useAdminUploads } from '@/hooks/queries/use-admin-uploads';
import { MetricsCards } from '@/components/admin/dashboard/metrics-cards';
import { RecentInquiries, RecentUploads } from '@/components/admin/dashboard/recent-widget';

export default function AdminDashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useAdminDashboard();
  const { data: intakeData, isLoading: intakeLoading } = useAdminIntake({ pageSize: 5 });
  const { data: uploadsData, isLoading: uploadsLoading } = useAdminUploads({ pageSize: 5 });

  return (
    <div className="space-y-8">
      {/* Metrics */}
      <MetricsCards metrics={metrics} isLoading={metricsLoading} />

      {/* Two-column widgets */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentInquiries
          items={intakeData?.items ?? []}
          isLoading={intakeLoading}
        />
        <RecentUploads
          items={uploadsData?.items ?? []}
          isLoading={uploadsLoading}
        />
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-5 py-4">
        <p className="text-sm font-medium text-brand-orange">
          ⚠ Backend admin routes are not yet implemented
        </p>
        <p className="mt-1 text-xs text-brand-muted">
          All dashboard metrics and tables show empty data. Replace the stubs in{' '}
          <code className="font-mono text-brand-text">
            src/lib/api/admin-client.ts
          </code>{' '}
          with real API calls once{' '}
          <code className="font-mono text-brand-text">/api/admin/*</code> routes are live.
        </p>
      </div>
    </div>
  );
}
