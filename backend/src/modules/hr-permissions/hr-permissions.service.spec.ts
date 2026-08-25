import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HrPermissionsService } from './hr-permissions.service';
import { HrPermission } from './entities/hr-permission.entity';
import { Employee } from '../employees/entities/employee.entity';
import { HR_MODULES, FULL_HR_PERMISSIONS } from '../../common/constants/hr-modules';

describe('HrPermissionsService', () => {
  let service: HrPermissionsService;
  let permissionRepo: Record<string, jest.Mock>;
  let employeeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    permissionRepo = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((obj: unknown) => obj),
      save: jest.fn(),
    };
    employeeRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrPermissionsService,
        { provide: getRepositoryToken(HrPermission), useValue: permissionRepo },
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
      ],
    }).compile();

    service = module.get(HrPermissionsService);
  });

  describe('getEffectivePermissions', () => {
    it('returns full access for a Super Admin regardless of stored rows', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e1', isSuperAdmin: true });
      const result = await service.getEffectivePermissions('e1');
      expect(result).toEqual(FULL_HR_PERMISSIONS);
      expect(permissionRepo.find).not.toHaveBeenCalled();
    });

    it('defaults every module to full access when no rows exist', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e2', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([]);
      const result = await service.getEffectivePermissions('e2');
      expect(result).toEqual(FULL_HR_PERMISSIONS);
    });

    it('applies a stored row as an override for its module only', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e3', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([
        { employeeId: 'e3', module: 'employees', canView: true, canManage: false },
      ]);
      const result = await service.getEffectivePermissions('e3');
      expect(result.employees).toEqual({ canView: true, canManage: false });
      expect(result.reports).toEqual({ canView: true, canManage: true });
    });

    it('throws NotFoundException for an unknown employee', async () => {
      employeeRepo.findOne.mockResolvedValue(null);
      await expect(service.getEffectivePermissions('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPermissions', () => {
    it('rejects setting permissions on a Super Admin', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e1', role: 'HR_ADMIN', isSuperAdmin: true });
      await expect(
        service.setPermissions('e1', [{ module: 'employees', canView: true, canManage: true }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects setting permissions on a non-HR_ADMIN employee', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e2', role: 'MANAGER', isSuperAdmin: false });
      await expect(
        service.setPermissions('e2', [{ module: 'employees', canView: true, canManage: true }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces the full row set for the employee', async () => {
      employeeRepo.findOne
        .mockResolvedValueOnce({ id: 'e3', role: 'HR_ADMIN', isSuperAdmin: false })
        .mockResolvedValueOnce({ id: 'e3', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([
        { employeeId: 'e3', module: 'employees', canView: false, canManage: false },
      ]);

      const entries = [{ module: 'employees' as const, canView: false, canManage: false }];
      const result = await service.setPermissions('e3', entries);

      expect(permissionRepo.delete).toHaveBeenCalledWith({ employeeId: 'e3' });
      expect(permissionRepo.save).toHaveBeenCalledWith([
        { employeeId: 'e3', module: 'employees', canView: false, canManage: false },
      ]);
      expect(result.employees).toEqual({ canView: false, canManage: false });
    });

    it('rejects an unknown module key', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e4', role: 'HR_ADMIN', isSuperAdmin: false });
      await expect(
        service.setPermissions('e4', [
          { module: 'notAModule' as any, canView: true, canManage: true },
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listHrAdmins', () => {
    it('returns every HR_ADMIN with their effective permissions', async () => {
      employeeRepo.find.mockResolvedValue([
        { id: 'e1', fullName: 'HR Admin User', email: 'admin@novelus.com', isSuperAdmin: true },
        { id: 'e2', fullName: 'hr salim 1', email: 'salim.hizi@esprit.tn', isSuperAdmin: false },
      ]);
      employeeRepo.findOne
        .mockResolvedValueOnce({ id: 'e1', isSuperAdmin: true })
        .mockResolvedValueOnce({ id: 'e2', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([]);

      const result = await service.listHrAdmins();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'e1', isSuperAdmin: true });
      expect(result[0].permissions).toEqual(FULL_HR_PERMISSIONS);
      expect(result[1]).toMatchObject({ id: 'e2', isSuperAdmin: false });
    });
  });
});
