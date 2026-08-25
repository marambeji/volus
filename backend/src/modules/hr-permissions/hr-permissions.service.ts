import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { HrPermission } from './entities/hr-permission.entity';
import { Employee } from '../employees/entities/employee.entity';
import {
  FULL_HR_PERMISSIONS,
  HR_MODULES,
  HrModule,
  HrPermissionMap,
} from '../../common/constants/hr-modules';

export interface SetPermissionEntry {
  module: HrModule;
  canView: boolean;
  canManage: boolean;
}

export interface HrAdminListItem {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: HrPermissionMap;
}

@Injectable()
export class HrPermissionsService {
  constructor(
    @InjectRepository(HrPermission)
    private readonly permissionRepo: Repository<HrPermission>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async getEffectivePermissions(employeeId: string): Promise<HrPermissionMap> {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found.`);
    }

    if (employee.isSuperAdmin) {
      return { ...FULL_HR_PERMISSIONS };
    }

    const rows = await this.permissionRepo.find({ where: { employeeId } });
    const rowsByModule = new Map(rows.map((row) => [row.module, row]));

    const result = {} as HrPermissionMap;
    for (const module of HR_MODULES) {
      const row = rowsByModule.get(module);
      result[module] = row
        ? { canView: row.canView, canManage: row.canManage }
        : { canView: true, canManage: true };
    }
    return result;
  }

  async listHrAdmins(): Promise<HrAdminListItem[]> {
    const admins = await this.employeeRepo.find({
      where: { role: 'HR_ADMIN' as any, deletedAt: IsNull() },
      order: { fullName: 'ASC' },
    });

    return Promise.all(
      admins.map(async (admin) => ({
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: await this.getEffectivePermissions(admin.id),
      })),
    );
  }

  async setPermissions(
    employeeId: string,
    entries: SetPermissionEntry[],
  ): Promise<HrPermissionMap> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, deletedAt: IsNull() },
    });
    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found.`);
    }
    if (employee.role !== ('HR_ADMIN' as any)) {
      throw new BadRequestException('Permissions can only be set for HR_ADMIN users.');
    }
    if (employee.isSuperAdmin) {
      throw new BadRequestException('Cannot restrict a Super Admin.');
    }

    const invalid = entries.filter((entry) => !(HR_MODULES as readonly string[]).includes(entry.module));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown module(s): ${invalid.map((entry) => entry.module).join(', ')}`,
      );
    }

    await this.permissionRepo.delete({ employeeId });

    if (entries.length > 0) {
      const rows = entries.map((entry) =>
        this.permissionRepo.create({
          employeeId,
          module: entry.module,
          canView: entry.canView,
          canManage: entry.canManage,
        }),
      );
      await this.permissionRepo.save(rows);
    }

    return this.getEffectivePermissions(employeeId);
  }
}
