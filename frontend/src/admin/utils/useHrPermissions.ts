import { useMemo } from 'react';
import type { HrModule, HrPermissionMap } from '../types/hrPermissions';
import { FULL_HR_PERMISSIONS } from '../types/hrPermissions';

interface StoredUser {
  isSuperAdmin?: boolean;
  permissions?: HrPermissionMap;
}

export function getCurrentUser(): StoredUser {
  try {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function isSuperAdmin(): boolean {
  return !!getCurrentUser().isSuperAdmin;
}

export function useHrPermission(module: HrModule): { canView: boolean; canManage: boolean } {
  return useMemo(() => {
    const user = getCurrentUser();
    if (user.isSuperAdmin) return { canView: true, canManage: true };
    return user.permissions?.[module] ?? FULL_HR_PERMISSIONS[module];
  }, [module]);
}
