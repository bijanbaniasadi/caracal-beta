'use client';

// ─── Base skeleton block ───────────────────────────────────────────────────────

function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/[0.07] ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Card skeleton ─────────────────────────────────────────────────────────────

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <Bone className="h-4 w-2/5" />
      {Array.from({ length: rows }).map((_, i) => (
        <Bone key={i} className={`h-3 ${i === rows - 1 ? 'w-3/5' : 'w-full'}`} />
      ))}
    </div>
  );
}

// ─── Order row skeleton ────────────────────────────────────────────────────────

export function OrderRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="space-y-2 flex-1">
        <Bone className="h-4 w-1/4" />
        <Bone className="h-3 w-1/3" />
      </div>
      <Bone className="h-6 w-20 rounded-full" />
      <Bone className="h-5 w-16" />
    </div>
  );
}

// ─── Upload card skeleton ──────────────────────────────────────────────────────

export function UploadCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Bone className="h-4 w-1/2" />
          <Bone className="h-3 w-1/3" />
        </div>
        <Bone className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Bone className="h-3 w-24" />
        <Bone className="h-3 w-32" />
      </div>
    </div>
  );
}

// ─── Profile skeleton ─────────────────────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ─── Summary stat skeleton ────────────────────────────────────────────────────

export function StatSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
      <Bone className="h-8 w-16" />
      <Bone className="h-3 w-24" />
    </div>
  );
}
