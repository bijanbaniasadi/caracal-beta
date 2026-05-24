'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getDashboardMetrics } from '@/lib/api/admin-client';
import type { DashboardMetrics } from '@/lib/api/admin-types';

export const adminDashboardKey = ['admin', 'dashboard', 'metrics'] as const;

export function useAdminDashboard(): UseQueryResult<DashboardMetrics, Error> {
  return useQuery({
    queryKey: adminDashboardKey,
    queryFn: getDashboardMetrics,
    staleTime: 60_000,
    retry: false,
  });
}
