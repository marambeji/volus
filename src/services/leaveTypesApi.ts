import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';

export interface LeaveTypeItem {
  id: string;
  key: string;
  label: string;
  trackingMode: 'AVAILABLE_BALANCE' | 'USAGE_YTD';
  color: string;
  displayOrder: number;
}

export async function getLeaveTypes(
  signal?: AbortSignal,
  limit = 100
): Promise<LeaveTypeItem[]> {
  const res = await apiFetch<PaginatedResponse<LeaveTypeItem>>(
    `/leave-types?limit=${limit}`,
    { signal }
  );
  return res.data.filter(
    (lt) =>
      !lt.key.toLowerCase().startsWith('e2e') &&
      !lt.label.toLowerCase().startsWith('e2e')
  );
}
