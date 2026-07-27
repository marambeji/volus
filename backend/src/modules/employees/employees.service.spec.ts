/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { EmployeePolicyAssignment } from './entities/employee-policy-assignment.entity';
import { LeavePolicy } from '../policies/entities/leave-policy.entity';
import { Country } from '../countries/entities/country.entity';
import { Division } from '../divisions/entities/division.entity';
import { ApprovalWorkflow } from '../approval-workflows/entities/approval-workflow.entity';
import { EmployeeStatus } from '../../common/enums';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('EmployeesService Unit Tests', () => {
  let service: EmployeesService;
  let employeeRepo: Record<string, jest.Mock>;
  let countryRepo: Record<string, jest.Mock>;
  let policyRepo: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    employeeRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    countryRepo = {
      findOne: jest.fn(),
    };
    policyRepo = {
      findOne: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (em: Record<string, unknown>) => unknown) =>
        cb({
          create: jest.fn((_entity: unknown, obj: Record<string, unknown>) => ({
            id: 'new-id',
            ...obj,
          })),
          save: jest.fn((obj: Record<string, unknown>) =>
            Promise.resolve({ id: 'new-id', ...obj }),
          ),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: getRepositoryToken(EmployeePolicyAssignment), useValue: {} },
        { provide: getRepositoryToken(LeavePolicy), useValue: policyRepo },
        { provide: getRepositoryToken(Country), useValue: countryRepo },
        { provide: getRepositoryToken(Division), useValue: {} },
        { provide: getRepositoryToken(ApprovalWorkflow), useValue: {} },
        {
          provide: AuditLogsService,
          useValue: {
            log: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should normalize email to lowercase and trim whitespace', async () => {
    countryRepo.findOne.mockResolvedValue({ id: 'c1', code: 'LB' });
    policyRepo.findOne.mockResolvedValue({ id: 'p1', rules: [] });

    employeeRepo.findOne.mockImplementation(
      ({ where }: { where: Record<string, string> }) => {
        if (where?.id === 'new-id') {
          return Promise.resolve({
            id: 'new-id',
            fullName: 'Test User',
            email: 'test.user@novelus.com',
            countryId: 'c1',
            status: EmployeeStatus.ACTIVE,
          });
        }
        return Promise.resolve(null);
      },
    );

    await service.create({
      fullName: 'Test User',
      email: '  TEST.USER@NOVELUS.COM  ',
      jobTitle: 'Developer',
      department: 'Tech',
      countryCode: 'LB',
      policyId: 'p1',
      hireDate: '2024-01-01',
    });

    expect(employeeRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'test.user@novelus.com' }),
      }),
    );
  });

  it('should throw ConflictException on duplicate email', async () => {
    employeeRepo.findOne.mockResolvedValue({
      id: 'e1',
      email: 'duplicate@novelus.com',
    });

    await expect(
      service.create({
        fullName: 'Duplicate',
        email: 'duplicate@novelus.com',
        jobTitle: 'Dev',
        department: 'Tech',
        countryCode: 'LB',
        policyId: 'p1',
        hireDate: '2024-01-01',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if employee manages themselves', async () => {
    employeeRepo.findOne.mockResolvedValue({
      id: 'e1',
      status: EmployeeStatus.ACTIVE,
    });

    await expect(service.update('e1', { managerId: 'e1' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on circular manager assignment', async () => {
    employeeRepo.findOne.mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === 'e1')
          return Promise.resolve({
            id: 'e1',
            managerId: null,
            status: EmployeeStatus.ACTIVE,
          });
        if (where.id === 'e2')
          return Promise.resolve({
            id: 'e2',
            managerId: 'e3',
            status: EmployeeStatus.ACTIVE,
          });
        if (where.id === 'e3')
          return Promise.resolve({
            id: 'e3',
            managerId: 'e1',
            status: EmployeeStatus.ACTIVE,
          });
        return Promise.resolve(null);
      },
    );

    await expect(service.update('e1', { managerId: 'e2' })).rejects.toThrow(
      'Circular manager assignment detected.',
    );
  });

  it('should throw BadRequestException if assigned manager is archived', async () => {
    countryRepo.findOne.mockResolvedValue({ id: 'c1', code: 'LB' });

    employeeRepo.findOne.mockImplementation(
      ({ where }: { where: Record<string, string> }) => {
        if (where?.id === 'm1') {
          return Promise.resolve({ id: 'm1', status: EmployeeStatus.ARCHIVED });
        }
        return Promise.resolve(null);
      },
    );

    await expect(
      service.create({
        fullName: 'New User',
        email: 'new@novelus.com',
        jobTitle: 'Dev',
        department: 'Tech',
        countryCode: 'LB',
        policyId: 'p1',
        managerId: 'm1',
        hireDate: '2024-01-01',
      }),
    ).rejects.toThrow('Cannot assign an archived employee as a manager.');
  });

  it('should soft-delete employee and clear manager_id for direct reports', async () => {
    employeeRepo.findOne.mockResolvedValue({
      id: 'e1',
      status: EmployeeStatus.ACTIVE,
    });
    employeeRepo.save.mockImplementation((obj: Record<string, unknown>) =>
      Promise.resolve(obj),
    );

    await service.remove('e1');

    expect(employeeRepo.update).toHaveBeenCalledWith(
      { managerId: 'e1' },
      { managerId: null },
    );
    expect(employeeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: EmployeeStatus.ARCHIVED,
        deletedAt: expect.any(Date),
      }),
    );
  });
});
