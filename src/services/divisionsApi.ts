import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';

export interface DivisionItem {
  id: string;
  name: string;
}

export async function getDivisions(
  signal?: AbortSignal,
  limit = 100
): Promise<DivisionItem[]> {
  const res = await apiFetch<PaginatedResponse<DivisionItem>>(
    `/divisions?limit=${limit}`,
    { signal }
  );
  return res.data;
}
