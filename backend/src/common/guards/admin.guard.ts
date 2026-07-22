import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Employee } from '../../modules/employees/entities/employee.entity';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const employeeId = request.headers['x-employee-id'];
    
    if (!employeeId) {
      throw new UnauthorizedException('Missing x-employee-id header');
    }

    const employee = await this.dataSource.getRepository(Employee).findOne({
      where: { id: employeeId }
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid x-employee-id');
    }

    if (employee.role !== 'HR_ADMIN') {
      throw new ForbiddenException('Requires HR_ADMIN role');
    }

    request.user = employee; // attach to request for controllers to use
    return true;
  }
}
