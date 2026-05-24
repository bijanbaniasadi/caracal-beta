import type { DashboardMetrics } from '@/lib/api/admin-types';
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
  metrics: DashboardMetrics | undefined;
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

  // Derive flat counts from the real nested shape
  const activeProducts   = metrics.products.ACTIVE ?? 0;
  const draftProducts    = metrics.products.DRAFT ?? 0;
  const totalProducts    = Object.values(metrics.products).reduce((a, b) => a + (b ?? 0), 0);
  const publishedArticles = metrics.articles.PUBLISHED ?? 0;
  const totalArticles    = Object.values(metrics.articles).reduce((a, b) => a + (b ?? 0), 0);
  const newInquiries     = (metrics.inquiries.quoteRequests.NEW ?? 0)
    + (metrics.inquiries.productInquiries.NEW ?? 0)
    + (metrics.inquiries.workshopConsultations.NEW ?? 0);
  const pendingUploads   = metrics.uploads.RECEIVED ?? 0;
  const lowStock         = metrics.inventory.LOW_STOCK ?? 0;
  const outOfStock       = metrics.inventory.OUT_OF_STOCK ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Active Products"
        value={activeProducts}
        sub={`${totalProducts} total`}
        accent="text-brand-green"
      />
      <MetricCard
        label="Draft Products"
        value={draftProducts}
      />
      <MetricCard
        label="Published Articles"
        value={publishedArticles}
        sub={`${totalArticles} total`}
        accent="text-sky-400"
      />
      <MetricCard
        label="New Inquiries"
        value={newInquiries}
        accent={newInquiries > 0 ? 'text-brand-orange' : 'text-brand-text'}
      />
      <MetricCard
        label="Pending Uploads"
        value={pendingUploads}
        accent={pendingUploads > 0 ? 'text-amber-400' : 'text-brand-text'}
      />
      <MetricCard
        label="Low Stock"
        value={lowStock}
        accent={lowStock > 0 ? 'text-amber-400' : 'text-brand-text'}
      />
      <MetricCard
        label="Out of Stock"
        value={outOfStock}
        accent={outOfStock > 0 ? 'text-red-400' : 'text-brand-text'}
      />
      <MetricCard
        label="Total Products"
        value={totalProducts}
      />
    </div>
  );
}
