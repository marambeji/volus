import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Headers,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { EmployeesService } from './employees.service';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@ApiTags('Employees')
@Controller({ path: 'employees', version: '1' })
export class EmployeesController {
  constructor(
    private readonly service: EmployeesService,
    private readonly leaveBalancesService: LeaveBalancesService,
  ) {}

  @Post('dev-login')
  @ApiOperation({ summary: 'Mock login endpoint for development' })
  devLogin(@Body('email') email: string) {
    if (!email) throw new UnauthorizedException('Email is required');
    return this.service.devLogin(email);
  }

  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('employees', 'manage')
  @ApiOperation({ summary: 'Create an employee with policy assignment' })
  create(@Body() dto: CreateEmployeeDto, @Headers('x-employee-id') actorId?: string) {
    return this.service.create(dto, actorId);
  }

  @Get('directory')
  @UseGuards(PermissionGuard)
  @RequireModule('employees', 'view')
  @ApiOperation({ summary: 'Get directory of active employees' })
  getDirectory(@Query() query: { page?: number; limit?: number; q?: string; department?: string }) {
    return this.service.getDirectory(query);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('employees', 'view')
  @ApiOperation({
    summary: 'List employees with pagination, search, and filters',
  })
  findAll(@Query() query: EmployeeQueryDto) {
    return this.service.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the profile of the authenticated employee' })
  async getMe(@Headers('x-employee-id') employeeId: string) {
    if (!employeeId) {
      throw new UnauthorizedException('Missing x-employee-id header');
    }
    return this.service.findOne(employeeId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Self-service update profile for authenticated employee' })
  async updateMe(
    @Headers('x-employee-id') employeeId: string,
    @Body() dto: Record<string, any>,
  ) {
    if (!employeeId) {
      throw new UnauthorizedException('Missing x-employee-id header');
    }

    const protectedFields = [
      'role',
      'status',
      'employmentType',
      'managerId',
      'countryCode',
      'countryId',
      'department',
      'employeeNumber',
      'divisionId',
      'approvalWorkflowId',
      'policyId',
      'hireDate',
    ];

    const attemptedProtected = Object.keys(dto).filter((key) =>
      protectedFields.includes(key),
    );

    if (attemptedProtected.length > 0) {
      throw new ForbiddenException(
        `Employees are not allowed to update protected fields: ${attemptedProtected.join(', ')}`,
      );
    }

    return this.service.update(employeeId, dto as any, employeeId);
  }

  @Get('me/leave-balances')
  @ApiOperation({ summary: 'Get calculated leave balances for the authenticated employee' })
  async getMyLeaveBalances(@Headers('x-employee-id') employeeId: string) {
    if (!employeeId) {
      throw new UnauthorizedException('Missing x-employee-id header');
    }
    return this.leaveBalancesService.calculateBalancesForEmployee(employeeId);
  }


  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('employees', 'view')
  @ApiOperation({ summary: 'Get employee detail by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/leave-configuration')
  @UseGuards(PermissionGuard)
  @RequireModule('employees', 'view')
  @ApiOperation({ summary: 'Get effective leave configuration for an employee' })
  getLeaveConfiguration(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getLeaveConfiguration(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('employees', 'manage')
  @ApiOperation({ summary: 'Update an employee and manage policy changes' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Headers('x-employee-id') actorId?: string,
  ) {
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('employees', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an employee (archive)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Headers('x-employee-id') actorId?: string) {
    return this.service.remove(id, actorId);
  }
}
