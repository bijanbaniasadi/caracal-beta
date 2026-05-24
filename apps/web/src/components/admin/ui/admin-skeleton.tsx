// Reusable loading skeleton blocks for admin UI

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={['h-4 animate-pulse rounded bg-white/10', className].join(' ')}
    />
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={['animate-pulse rounded bg-white/10', className].join(' ')}
    />
  );
}

export function AdminTableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full">
        <thead className="border-b border-white/10 bg-white/[0.03]">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <SkeletonLine className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <SkeletonLine className={c === 0 ? 'w-32' : 'w-20'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <SkeletonLine className="w-24 h-3 mb-3" />
      <SkeletonLine className="w-16 h-8" />
    </div>
  );
}
