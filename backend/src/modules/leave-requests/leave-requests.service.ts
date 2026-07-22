import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { LeaveRequestStatus, LedgerTransactionType } from '../../common/enums';
import { LeaveLedgerEntry } from '../leave-balances/entities/leave-ledger-entry.entity';
import { LeaveBalance } from '../leave-balances/entities/leave-balance.entity';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly requestRepo: Repository<LeaveRequest>,
    private readonly leaveBalancesService: LeaveBalancesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(employeeId: string, dto: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; reason?: string }) {
    // 1. Recalculate balance to validate
    const balancesData = await this.leaveBalancesService.calculateBalancesForEmployee(employeeId);
    
    const balanceConfig = balancesData.balances.find(b => b.leaveTypeId === dto.leaveTypeId);
    if (!balanceConfig) {
      throw new BadRequestException('Leave type is not available in your active policy.');
    }

    if (balanceConfig.requiresPositiveBalance && balanceConfig.trackingMode === 'AVAILABLE_BALANCE') {
      if (balanceConfig.availableBalance < dto.durationDays) {
        throw new BadRequestException(`Insufficient balance. You need ${dto.durationDays} day(s) but only have ${balanceConfig.availableBalance}.`);
      }
    }

    // 2. Atomically create request
    const request = this.requestRepo.create({
      employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      durationDays: dto.durationDays,
      reason: dto.reason,
      status: LeaveRequestStatus.PENDING,
    });

    return this.requestRepo.save(request);
  }

  async cancel(employeeId: string, requestId: string) {
    return this.dataSource.transaction(async (em) => {
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId, employeeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status === LeaveRequestStatus.CANCELLED) return request;
      if (request.status === LeaveRequestStatus.REJECTED) throw new BadRequestException('Cannot cancel a rejected request');

      const wasApproved = request.status === LeaveRequestStatus.APPROVED;
      request.status = LeaveRequestStatus.CANCELLED;
      const saved = await em.save(request);

      if (wasApproved) {
        // Reverse usage in ledger
        const currentYear = new Date(request.startDate).getFullYear();
        const balance = await em.findOne(LeaveBalance, {
          where: { employeeId, leaveTypeId: request.leaveTypeId, year: currentYear },
        });

        if (balance) {
          const ledgerEntry = em.create(LeaveLedgerEntry, {
            balanceId: balance.id,
            employeeId,
            leaveTypeId: request.leaveTypeId,
            transactionType: LedgerTransactionType.REVERSAL,
            signedAmount: request.durationDays,
            resultingBalance: 0, // Since we recalculate, this is just a dummy column for reversals usually, or we recalculate.
            reason: 'Cancelled approved leave request',
            referenceType: 'LEAVE_REQUEST',
            referenceId: request.id,
            performedByEmployeeId: employeeId,
          });
          await em.save(ledgerEntry);
        }
      }

      return saved;
    });
  }
  async hrFindAll(query: any) {
    const { status, employeeId, department, country, leaveTypeId, startDate, endDate } = query;
    const qb = this.requestRepo.createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('emp.country', 'country')
      .leftJoinAndSelect('emp.policyAssignments', 'epa', 'epa.is_active = true')
      .leftJoinAndSelect('epa.leavePolicy', 'leavePolicy')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .leftJoinAndSelect('lr.reviewer', 'reviewer');

    if (status) qb.andWhere('lr.status = :status', { status });
    if (employeeId) qb.andWhere('lr.employeeId = :employeeId', { employeeId });
    if (department) qb.andWhere('emp.department = :department', { department });
    if (country) qb.andWhere('country.name = :country', { country });
    if (leaveTypeId) qb.andWhere('lr.leaveTypeId = :leaveTypeId', { leaveTypeId });
    if (startDate) qb.andWhere('lr.startDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('lr.endDate <= :endDate', { endDate });

    qb.orderBy('lr.createdAt', 'DESC');
    
    const requests = await qb.getMany();
    return requests.map(lr => ({
      requestId: lr.id,
      employeeId: lr.employeeId,
      employeeName: lr.employee?.fullName,
      employeeEmail: lr.employee?.email,
      employeeNumber: lr.employee?.employeeNumber,
      department: lr.employee?.department,
      team: lr.employee?.unit,
      country: lr.employee?.country?.name,
      policyId: lr.employee?.policyAssignments?.[0]?.leavePolicyId,
      policyName: lr.employee?.policyAssignments?.[0]?.leavePolicy?.policyName,
      leaveTypeId: lr.leaveTypeId,
      leaveTypeName: lr.leaveType?.label,
      startDate: lr.startDate,
      endDate: lr.endDate,
      requestedDuration: lr.durationDays,
      halfDayInformation: null,
      employeeNote: lr.reason,
      supportingDocumentMetadata: null,
      currentStatus: lr.status,
      submittedAt: lr.createdAt,
      reviewedAt: lr.reviewedAt,
      reviewer: lr.reviewer?.fullName,
      rejectionReason: lr.rejectionReason,
    }));
  }

  async hrApprove(requestId: string, reviewerId: string) {
    return this.dataSource.transaction(async (em) => {
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be approved');
      }

      const currentYear = new Date(request.startDate).getFullYear();
      const balance = await em.findOne(LeaveBalance, {
        where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: currentYear },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) throw new BadRequestException('Balance not found for the requested leave type and year.');

      // Check positive balance requirement
      const balancesData = await this.leaveBalancesService.calculateBalancesForEmployee(request.employeeId);
      const balanceConfig = balancesData.balances.find(b => b.leaveTypeId === request.leaveTypeId);
      if (balanceConfig && balanceConfig.requiresPositiveBalance && balanceConfig.trackingMode === 'AVAILABLE_BALANCE') {
        if (balanceConfig.availableBalance < request.durationDays) {
          throw new BadRequestException(`Insufficient balance. Cannot approve.`);
        }
      }

      request.status = LeaveRequestStatus.APPROVED;
      request.reviewerId = reviewerId;
      request.reviewedAt = new Date();
      await em.save(request);

      const ledgerEntry = em.create(LeaveLedgerEntry, {
        balanceId: balance.id,
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        transactionType: LedgerTransactionType.USAGE,
        signedAmount: -request.durationDays,
        resultingBalance: 0,
        reason: 'HR Approved Leave Request',
        referenceType: 'LEAVE_REQUEST',
        referenceId: request.id,
        performedByEmployeeId: reviewerId,
      });
      await em.save(ledgerEntry);

      return request;
    });
  }

  async hrReject(requestId: string, reviewerId: string, reason: string) {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Rejection reason is required.');
    }

    return this.dataSource.transaction(async (em) => {
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) throw new NotFoundException('Leave request not found');
      if (request.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException('Only pending requests can be rejected');
      }

      request.status = LeaveRequestStatus.REJECTED;
      request.reviewerId = reviewerId;
      request.reviewedAt = new Date();
      request.rejectionReason = reason.trim();
      
      return em.save(request);
    });
  }
}
