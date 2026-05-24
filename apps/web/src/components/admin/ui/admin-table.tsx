import type { ReactNode } from 'react';

// ─── Table shell ──────────────────────────────────────────────────────────────

export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

// ─── Head ─────────────────────────────────────────────────────────────────────

export function AdminThead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-white/10 bg-white/[0.03]">
      {children}
    </thead>
  );
}

export function AdminTh({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={[
        'px-4 py-3 text-left font-technical text-xs font-semibold uppercase tracking-wider text-brand-muted',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export function AdminTbody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-white/5">{children}</tbody>
  );
}

export function AdminTr({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={[
        'transition-colors hover:bg-white/[0.03]',
        onClick ? 'cursor-pointer' : '',
        className,
      ].join(' ')}
    >
      {children}
    </tr>
  );
}

export function AdminTd({
  children,
  className = '',
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={[
        'px-4 py-3 text-sm text-brand-text',
        className,
      ].join(' ')}
    >
      {children}
    </td>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function AdminTableEmpty({
  message = 'No records found',
  colSpan = 6,
}: {
  message?: string;
  colSpan?: number;
}) {
  return (
    <AdminTbody>
      <tr>
        <td
          colSpan={colSpan}
          className="px-4 py-16 text-center text-sm text-brand-muted"
        >
          {message}
        </td>
      </tr>
    </AdminTbody>
  );
}

// ─── Pagination bar ───────────────────────────────────────────────────────────

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export function AdminPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: AdminPaginationProps) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-brand-muted">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded px-2 py-1 hover:bg-white/5 disabled:opacity-30"
        >
          ‹ Prev
        </button>
        <span className="px-2 font-medium text-brand-text">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded px-2 py-1 hover:bg-white/5 disabled:opacity-30"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
