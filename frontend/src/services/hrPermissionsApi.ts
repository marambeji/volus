import { apiFetch } from './apiClient';
import type { HrModule, HrPermissionMap } from '../admin/types/hrPermissions';

export interface HrAdminListItem {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: HrPermissionMap;
}

export interface HrPermissionEntry {
  module: HrModule;
  canView: boolean;
  canManage: boolean;
}

export async function getHrAdmins(signal?: AbortSignal): Promise<HrAdminListItem[]> {
  return apiFetch<HrAdminListItem[]>('/hr-permissions', { signal });
}

export async function getHrPermissions(
  employeeId: string,
  signal?: AbortSignal,
): Promise<HrPermissionMap> {
  return apiFetch<HrPermissionMap>(`/hr-permissions/${employeeId}`, { signal });
}

export async function setHrPermissions(
  employeeId: string,
  permissions: HrPermissionEntry[],
): Promise<HrPermissionMap> {
  return apiFetch<HrPermissionMap>(`/hr-permissions/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}
