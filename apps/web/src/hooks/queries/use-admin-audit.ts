'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listAuditLogs } from '@/lib/api/admin-client';
import type { AuditLogRecord, ListParams, PaginatedList } from '@/lib/api/admin-types';

export const adminAuditKey = (params?: ListParams) =>
  ['admin', 'audit', params] as const;

/**
 * Fetches the audit log table.
 *
 * Backed by GET /api/admin/audit-logs — currently returns empty list.
 */
export function useAdminAudit(
  params?: ListParams,
): UseQueryResult<PaginatedList<AuditLogRecord>, Error> {
  return useQuery<PaginatedList<AuditLogRecord>, Error>({
    queryKey: adminAuditKey(params),
    queryFn: () => listAuditLogs(params),
    staleTime: 60_000,   // Audit logs don't change; 60s freshness is fine.
    gcTime: 10 * 60 * 1_000,
    retry: false,
  });
}
