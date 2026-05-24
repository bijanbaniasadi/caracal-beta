'use client';

import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<TRow> {
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  /** Extra Tailwind classes applied to both <th> and <td>. */
  className?: string;
}

interface DataTableProps<TRow> {
  columns: ColumnDef<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Number of skeleton rows shown while loading. Default: 8. */
  loadingRowCount?: number;
  /** Optional footer (pagination controls, row-count, etc.). */
  footer?: ReactNode;
}

// ─── Loading skeleton row ─────────────────────────────────────────────────────

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-gray-200" />
        </td>
      ))}
    </tr>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyRow({
  colCount,
  title,
  description,
}: {
  colCount: number;
  title: string;
  description?: string;
}) {
  return (
    <tr>
      <td colSpan={colCount} className="px-4 py-16 text-center">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Generic, typed data table used across all admin pages.
 *
 * Handles three states automatically:
 *   isLoading  → shows animated skeleton rows
 *   empty data → shows empty-state message
 *   data       → renders rows with per-column cell renderers
 */
export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription,
  loadingRowCount = 8,
  footer,
}: DataTableProps<TRow>) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Header */}
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={[
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500',
                    col.className ?? '',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              Array.from({ length: loadingRowCount }).map((_, i) => (
                <SkeletonRow key={i} colCount={columns.length} />
              ))
            ) : rows.length === 0 ? (
              <EmptyRow
                colCount={columns.length}
                title={emptyTitle}
                description={emptyDescription}
              />
            ) : (
              rows.map((row) => (
                <tr key={getRowKey(row)} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={[
                        'px-4 py-3 text-sm text-gray-900',
                        col.className ?? '',
                      ].join(' ')}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer slot (pagination, row count…) */}
      {footer && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}
