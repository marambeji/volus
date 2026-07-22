import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Headers,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Create an employee with policy assignment' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Get('directory')
  @ApiOperation({ summary: 'Get directory of active employees' })
  getDirectory(@Query() query: { page?: number; limit?: number; q?: string; department?: string }) {
    return this.service.getDirectory(query);
  }

  @Get()
  @ApiOperation({
    summary: 'List employees with pagination, search, and filters',
  })
  findAll(@Query() query: EmployeeQueryDto) {
    return this.service.findAll(query);
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
  @ApiOperation({ summary: 'Get employee detail by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/leave-configuration')
  @ApiOperation({ summary: 'Get effective leave configuration for an employee' })
  getLeaveConfiguration(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getLeaveConfiguration(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an employee and manage policy changes' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an employee (archive)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
