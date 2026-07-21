import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { LeaveBalancesService } from './leave-balances.service';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveLedgerEntry } from './entities/leave-ledger-entry.entity';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { LeaveTrackingMode, LedgerTransactionType } from '../../common/enums';

describe('LeaveBalancesService Unit Tests', () => {
  let service: LeaveBalancesService;
  let balanceRepo: Record<string, jest.Mock>;
  let ledgerRepo: Record<string, jest.Mock>;
  let employeeRepo: Record<string, jest.Mock>;
  let leaveTypeRepo: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    balanceRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    ledgerRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    employeeRepo = {
      findOne: jest.fn(),
    };
    leaveTypeRepo = {
      findOne: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveBalancesService,
        { provide: getRepositoryToken(LeaveBalance), useValue: balanceRepo },
        { provide: getRepositoryToken(LeaveLedgerEntry), useValue: ledgerRepo },
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
        { provide: getRepositoryToken(LeaveType), useValue: leaveTypeRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<LeaveBalancesService>(LeaveBalancesService);
  });

  it('should return existing ledger entry on matching idempotency key and fingerprint', async () => {
    const existingLedger = {
      id: 'l1',
      idempotencyKey: 'key-123',
      requestFingerprint: createHash('sha256')
        .update('emp1:lt1:2026:5.00:Reason test')
        .digest('hex'),
    };
    ledgerRepo.findOne.mockResolvedValue(existingLedger);

    const result = await service.adjust({
      employeeId: 'emp1',
      leaveTypeId: 'lt1',
      year: 2026,
      amount: 5,
      reason: 'Reason test',
      idempotencyKey: 'key-123',
    });

    expect(result).toBe(existingLedger);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('should throw ConflictException on matching idempotency key but different fingerprint', async () => {
    ledgerRepo.findOne.mockResolvedValue({
      id: 'l1',
      idempotencyKey: 'key-123',
      requestFingerprint: 'DIFFERENT_FINGERPRINT',
    });

    await expect(
      service.adjust({
        employeeId: 'emp1',
        leaveTypeId: 'lt1',
        year: 2026,
        amount: 5,
        reason: 'Reason test',
        idempotencyKey: 'key-123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if AVAILABLE_BALANCE goes below 0', async () => {
    ledgerRepo.findOne.mockResolvedValue(null);
    employeeRepo.findOne.mockResolvedValue({ id: 'emp1' });
    leaveTypeRepo.findOne.mockResolvedValue({
      id: 'lt1',
      trackingMode: LeaveTrackingMode.AVAILABLE_BALANCE,
    });

    dataSource.transaction.mockImplementation(
      (cb: (em: Record<string, unknown>) => unknown) =>
        cb({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'b1', availableBalance: 2, usedYtd: 0 }),
          save: jest.fn(),
          create: jest.fn(),
        }),
    );

    await expect(
      service.adjust({
        employeeId: 'emp1',
        leaveTypeId: 'lt1',
        year: 2026,
        amount: -5,
        reason: 'Overdraw attempt',
      }),
    ).rejects.toThrow('AVAILABLE_BALANCE cannot be negative.');
  });

  it('should throw BadRequestException if USAGE_YTD goes below 0', async () => {
    ledgerRepo.findOne.mockResolvedValue(null);
    employeeRepo.findOne.mockResolvedValue({ id: 'emp1' });
    leaveTypeRepo.findOne.mockResolvedValue({
      id: 'lt1',
      trackingMode: LeaveTrackingMode.USAGE_YTD,
    });

    dataSource.transaction.mockImplementation(
      (cb: (em: Record<string, unknown>) => unknown) =>
        cb({
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'b1', availableBalance: 0, usedYtd: 1 }),
          save: jest.fn(),
          create: jest.fn(),
        }),
    );

    await expect(
      service.adjust({
        employeeId: 'emp1',
        leaveTypeId: 'lt1',
        year: 2026,
        amount: -3,
        reason: 'Negative usage attempt',
      }),
    ).rejects.toThrow('USAGE_YTD cannot be negative.');
  });

  it('should perform atomic adjustment and save immutable ledger entry', async () => {
    ledgerRepo.findOne.mockResolvedValue(null);
    employeeRepo.findOne.mockResolvedValue({ id: 'emp1' });
    leaveTypeRepo.findOne.mockResolvedValue({
      id: 'lt1',
      trackingMode: LeaveTrackingMode.AVAILABLE_BALANCE,
    });

    const mockEm = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'b1', availableBalance: 10, usedYtd: 0 }),
      save: jest.fn((obj: Record<string, unknown>) =>
        Promise.resolve({ id: 'saved-id', ...obj }),
      ),
      create: jest.fn((_entity: unknown, obj: Record<string, unknown>) => ({
        id: 'created-id',
        ...obj,
      })),
    };

    dataSource.transaction.mockImplementation(
      (cb: (em: typeof mockEm) => unknown) => cb(mockEm),
    );

    const result = await service.adjust({
      employeeId: 'emp1',
      leaveTypeId: 'lt1',
      year: 2026,
      amount: 5,
      reason: 'Valid adjustment',
    });

    expect(mockEm.save).toHaveBeenCalledTimes(2);
    expect(result.signedAmount).toBe(5);
    expect(result.resultingBalance).toBe(15);
    expect(result.transactionType).toBe(
      LedgerTransactionType.MANUAL_ADJUSTMENT,
    );
  });
});
