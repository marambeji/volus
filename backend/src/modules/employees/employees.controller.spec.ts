import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { HrPermissionsService } from '../hr-permissions/hr-permissions.service';
import { REQUIRE_MODULE_KEY } from '../../common/decorators/require-module.decorator';

describe('EmployeesController', () => {
  let controller: EmployeesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        { provide: EmployeesService, useValue: { create: jest.fn(), update: jest.fn(), remove: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), getDirectory: jest.fn() } },
        { provide: LeaveBalancesService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: HrPermissionsService, useValue: {} },
        AdminGuard,
        PermissionGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get(EmployeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('requires manage permission on create', () => {
    const meta = Reflect.getMetadata(REQUIRE_MODULE_KEY, controller.create);
    expect(meta).toEqual({ module: 'employees', level: 'manage' });
  });

  it('requires view permission on findAll', () => {
    const meta = Reflect.getMetadata(REQUIRE_MODULE_KEY, controller.findAll);
    expect(meta).toEqual({ module: 'employees', level: 'view' });
  });
});
