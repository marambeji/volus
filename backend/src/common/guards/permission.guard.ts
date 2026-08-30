import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Employee } from '../../modules/employees/entities/employee.entity';
import { HrPermissionsService } from '../../modules/hr-permissions/hr-permissions.service';
import { REQUIRE_MODULE_KEY, RequireModuleMeta } from '../decorators/require-module.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    private readonly hrPermissionsService: HrPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<RequireModuleMeta>(REQUIRE_MODULE_KEY, context.getHandler());
    if (!meta) return true;
    const { module, level } = meta;

    const request = context.switchToHttp().getRequest();
    let employee: Employee | null = request.user ?? null;

    if (!employee) {
      const employeeId = request.headers['x-employee-id'];
      if (!employeeId) {
        if (level === 'manage') throw new UnauthorizedException('Missing x-employee-id header');
        return true;
      }

      employee = await this.dataSource.getRepository(Employee).findOne({
        where: { id: employeeId },
      });

      if (!employee) {
        if (level === 'manage') throw new UnauthorizedException('Invalid x-employee-id');
        return true;
      }
      request.user = employee;
    }

    if (employee.role !== ('HR_ADMIN' as any)) {
      if (level === 'manage') throw new ForbiddenException('Requires HR_ADMIN role');
      return true;
    }

    if (employee.isSuperAdmin) return true;

    const permissions = await this.hrPermissionsService.getEffectivePermissions(employee.id);
    const allowed = level === 'manage' ? permissions[module].canManage : permissions[module].canView;
    if (!allowed) {
      throw new ForbiddenException(`Missing ${level} permission for module "${module}"`);
    }
    return true;
  }
}
