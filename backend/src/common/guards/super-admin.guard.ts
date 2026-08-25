import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Employee } from '../../modules/employees/entities/employee.entity';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const employeeId = request.headers['x-employee-id'];

    if (!employeeId) {
      throw new UnauthorizedException('Missing x-employee-id header');
    }

    const employee = await this.dataSource.getRepository(Employee).findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid x-employee-id');
    }

    if (employee.role !== ('HR_ADMIN' as any) || !employee.isSuperAdmin) {
      throw new ForbiddenException('Requires Super Admin');
    }

    request.user = employee;
    return true;
  }
}
