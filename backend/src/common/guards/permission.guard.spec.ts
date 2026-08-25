import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { FULL_HR_PERMISSIONS } from '../constants/hr-modules';

function makeContext(headers: Record<string, string>, existingUser?: unknown): ExecutionContext {
  const request: any = { headers, user: existingUser };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let reflector: { get: jest.Mock };
  let employeeRepo: { findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let hrPermissionsService: { getEffectivePermissions: jest.Mock };
  let guard: PermissionGuard;

  beforeEach(() => {
    reflector = { get: jest.fn() };
    employeeRepo = { findOne: jest.fn() };
    dataSource = { getRepository: jest.fn(() => employeeRepo) };
    hrPermissionsService = { getEffectivePermissions: jest.fn() };
    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      dataSource as any,
      hrPermissionsService as any,
    );
  });

  it('passes through when no @RequireModule metadata is present', async () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(employeeRepo.findOne).not.toHaveBeenCalled();
  });

  it('allows a non-HR_ADMIN caller through a view check unconditionally', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'view' });
    employeeRepo.findOne.mockResolvedValue({ id: 'm1', role: 'MANAGER', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'm1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hrPermissionsService.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('allows a caller with no x-employee-id header through a view check', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'view' });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects a non-HR_ADMIN caller on a manage check', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    employeeRepo.findOne.mockResolvedValue({ id: 'm1', role: 'MANAGER', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'm1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a manage check with no x-employee-id header', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('always allows a Super Admin', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    employeeRepo.findOne.mockResolvedValue({ id: 'a1', role: 'HR_ADMIN', isSuperAdmin: true });
    const ctx = makeContext({ 'x-employee-id': 'a1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hrPermissionsService.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('blocks a restricted HR_ADMIN lacking the required permission', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    employeeRepo.findOne.mockResolvedValue({ id: 'h1', role: 'HR_ADMIN', isSuperAdmin: false });
    hrPermissionsService.getEffectivePermissions.mockResolvedValue({
      ...FULL_HR_PERMISSIONS,
      employees: { canView: true, canManage: false },
    });
    const ctx = makeContext({ 'x-employee-id': 'h1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows an HR_ADMIN with the required permission and reuses request.user if already set', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'view' });
    hrPermissionsService.getEffectivePermissions.mockResolvedValue(FULL_HR_PERMISSIONS);
    const ctx = makeContext({}, { id: 'h1', role: 'HR_ADMIN', isSuperAdmin: false });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(employeeRepo.findOne).not.toHaveBeenCalled();
  });
});
