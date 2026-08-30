import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHrPermission, getCurrentUser, isSuperAdmin } from './useHrPermissions';
import { FULL_HR_PERMISSIONS } from '../types/hrPermissions';

describe('useHrPermissions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to full access when there is no stored user', () => {
    const { result } = renderHook(() => useHrPermission('employees'));
    expect(result.current).toEqual({ canView: true, canManage: true });
  });

  it('returns full access for a Super Admin regardless of stored permissions', () => {
    localStorage.setItem('currentUser', JSON.stringify({ isSuperAdmin: true, permissions: { employees: { canView: false, canManage: false } } }));
    const { result } = renderHook(() => useHrPermission('employees'));
    expect(result.current).toEqual({ canView: true, canManage: true });
  });

  it('returns the stored permission for a restricted HR admin', () => {
    localStorage.setItem('currentUser', JSON.stringify({
      isSuperAdmin: false,
      permissions: { ...FULL_HR_PERMISSIONS, employees: { canView: true, canManage: false } },
    }));
    const { result } = renderHook(() => useHrPermission('employees'));
    expect(result.current).toEqual({ canView: true, canManage: false });
  });

  it('isSuperAdmin reads the stored flag', () => {
    localStorage.setItem('currentUser', JSON.stringify({ isSuperAdmin: true }));
    expect(isSuperAdmin()).toBe(true);
  });

  it('getCurrentUser tolerates malformed JSON', () => {
    localStorage.setItem('currentUser', '{not json');
    expect(getCurrentUser()).toEqual({});
  });
});
