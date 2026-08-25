import { apiFetch } from './apiClient';
import type { PaginatedResponse } from './apiClient';

export interface DepartmentItem {
  id: string;
  name: string;
  color: string;
  headEmployeeId: string | null;
  headEmployee?: { id: string; fullName: string } | null;
}

export interface DepartmentPayload {
  name: string;
  color?: string;
  headEmployeeId?: string | null;
}

export async function getDepartments(
  signal?: AbortSignal,
  limit = 100
): Promise<DepartmentItem[]> {
  const res = await apiFetch<PaginatedResponse<DepartmentItem>>(
    `/departments?limit=${limit}`,
    { signal }
  );
  return res.data;
}

export async function createDepartment(payload: DepartmentPayload): Promise<DepartmentItem> {
  return apiFetch<DepartmentItem>('/departments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDepartment(id: string, payload: Partial<DepartmentPayload>): Promise<DepartmentItem> {
  return apiFetch<DepartmentItem>(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteDepartment(id: string): Promise<void> {
  return apiFetch<void>(`/departments/${id}`, { method: 'DELETE' });
}
