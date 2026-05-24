import type { AdminDashboardMetrics } from '@/lib/api/admin-types';
import { MetricCardSkeleton } from '@/components/admin/ui/admin-skeleton';

interface MetricCardProps {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}

function MetricCard({ label, value, sub, accent = 'text-brand-text' }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-technical text-xs font-semibold uppercase tracking-wider text-brand-muted">
        {label}
      </p>
      <p className={['mt-2 font-display text-3xl font-bold', accent].join(' ')}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="mt-1 text-xs text-brand-muted">{sub}</p>}
    </div>
  );
}

interface MetricsCardsProps {
  metrics: AdminDashboardMetrics | undefined;
  isLoading: boolean;
}

export function MetricsCards({ metrics, isLoading }: MetricsCardsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Active Products"
        value={metrics.activeProducts}
        sub={`${metrics.totalProducts} total`}
        accent="text-brand-green"
      />
      <MetricCard
        label="Draft Products"
        value={metrics.draftProducts}
      />
      <MetricCard
        label="Published Articles"
        value={metrics.publishedArticles}
        sub={`${metrics.totalArticles} total`}
        accent="text-sky-400"
      />
      <MetricCard
        label="New Inquiries"
        value={metrics.newInquiries}
        accent={metrics.newInquiries > 0 ? 'text-brand-orange' : 'text-brand-text'}
      />
      <MetricCard
        label="Pending Uploads"
        value={metrics.pendingUploads}
        accent={metrics.pendingUploads > 0 ? 'text-amber-400' : 'text-brand-text'}
      />
      <MetricCard
        label="Low Stock"
        value={metrics.lowStockProducts}
        accent={metrics.lowStockProducts > 0 ? 'text-amber-400' : 'text-brand-text'}
      />
      <MetricCard
        label="Out of Stock"
        value={metrics.outOfStockProducts}
        accent={metrics.outOfStockProducts > 0 ? 'text-red-400' : 'text-brand-text'}
      />
      <MetricCard
        label="Total Products"
        value={metrics.totalProducts}
      />
    </div>
  );
}
