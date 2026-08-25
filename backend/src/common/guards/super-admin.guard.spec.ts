import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  let employeeRepo: { findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let guard: SuperAdminGuard;

  beforeEach(() => {
    employeeRepo = { findOne: jest.fn() };
    dataSource = { getRepository: jest.fn(() => employeeRepo) };
    guard = new SuperAdminGuard(dataSource as any);
  });

  it('throws Unauthorized with no x-employee-id header', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws Unauthorized for an unknown employee id', async () => {
    employeeRepo.findOne.mockResolvedValue(null);
    const ctx = makeContext({ 'x-employee-id': 'ghost' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws Forbidden for an HR_ADMIN who is not Super Admin', async () => {
    employeeRepo.findOne.mockResolvedValue({ id: 'h1', role: 'HR_ADMIN', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'h1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws Forbidden for a non-HR_ADMIN', async () => {
    employeeRepo.findOne.mockResolvedValue({ id: 'm1', role: 'MANAGER', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'm1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows the Super Admin through and attaches request.user', async () => {
    const admin = { id: 'a1', role: 'HR_ADMIN', isSuperAdmin: true };
    employeeRepo.findOne.mockResolvedValue(admin);
    const request: any = { headers: { 'x-employee-id': 'a1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toBe(admin);
  });
});
