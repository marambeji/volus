import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { EmployeeRole, EmployeeStatus, LeaveRequestStatus } from '../../common/enums';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';

export interface ReportsQuery {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  managerId?: string;
  department?: string;
  country?: string;
  leaveTypeId?: string;
  status?: string;
  year?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(LeaveRequest)
    private readonly requestRepo: Repository<LeaveRequest>,
    private readonly leaveBalancesService: LeaveBalancesService,
  ) {}

  private async loadActor(actorId: string): Promise<Employee> {
    if (!actorId) {
      throw new UnauthorizedException('Missing x-employee-id header');
    }
    const actor = await this.employeeRepo.findOne({ where: { id: actorId } });
    if (!actor) {
      throw new UnauthorizedException('Invalid x-employee-id');
    }
    return actor;
  }

  // ── Leave Requests Report ─────────────────────────────────────────────────

  async getRequests(actorId: string, query: ReportsQuery) {
    const actor = await this.loadActor(actorId);

    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('emp.country', 'country')
      .leftJoinAndSelect('lr.leaveType', 'leaveType');

    this.applyRequestScope(qb, actor, query);
    this.applyRequestFilters(qb, query);

    qb.orderBy('lr.startDate', 'DESC');

    const rows = await qb.getMany();
    return rows.map((lr) => ({
      id: lr.id,
      employeeId: lr.employeeId,
      employeeName: lr.employee?.fullName ?? 'Unknown',
      department: lr.employee?.department ?? null,
      country: lr.employee?.country?.name ?? null,
      leaveTypeId: lr.leaveTypeId,
      leaveTypeName: lr.leaveType?.label ?? lr.leaveType?.key ?? 'Unknown',
      startDate: lr.startDate,
      endDate: lr.endDate,
      durationDays: Number(lr.durationDays),
      status: lr.status,
      createdAt: lr.createdAt,
    }));
  }

  private applyRequestScope(
    qb: SelectQueryBuilder<LeaveRequest>,
    actor: Employee,
    query: ReportsQuery,
  ) {
    if (actor.role === EmployeeRole.EMPLOYEE) {
      qb.andWhere('lr.employeeId = :selfId', { selfId: actor.id });
      return;
    }
    if (actor.role === EmployeeRole.MANAGER) {
      qb.andWhere('emp.managerId = :managerId', { managerId: actor.id });
      return;
    }
    // HR_ADMIN — no forced scope, but an explicit managerId filter narrows to one team
    if (query.managerId) {
      qb.andWhere('emp.managerId = :queryManagerId', {
        queryManagerId: query.managerId,
      });
    }
  }

  private applyRequestFilters(
    qb: SelectQueryBuilder<LeaveRequest>,
    query: ReportsQuery,
  ) {
    if (query.employeeId) {
      qb.andWhere('lr.employeeId = :employeeId', {
        employeeId: query.employeeId,
      });
    }
    if (query.department) {
      qb.andWhere('emp.department = :department', {
        department: query.department,
      });
    }
    if (query.country) {
      qb.andWhere('country.name = :country', { country: query.country });
    }
    if (query.leaveTypeId) {
      qb.andWhere('lr.leaveTypeId = :leaveTypeId', {
        leaveTypeId: query.leaveTypeId,
      });
    }
    if (query.status) {
      qb.andWhere('lr.status = :status', { status: query.status });
    }
    // Overlap with [dateFrom, dateTo]: request must end on/after dateFrom
    // and start on/before dateTo.
    if (query.dateFrom) {
      qb.andWhere('lr.endDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('lr.startDate <= :dateTo', { dateTo: query.dateTo });
    }
  }

  // ── Leave Balances Report ─────────────────────────────────────────────────

  async getBalances(actorId: string, query: ReportsQuery) {
    const actor = await this.loadActor(actorId);

    const qb = this.employeeRepo
      .createQueryBuilder('emp')
      .leftJoinAndSelect('emp.country', 'country')
      .where('emp.deletedAt IS NULL')
      .andWhere('emp.status = :status', { status: EmployeeStatus.ACTIVE });

    if (actor.role === EmployeeRole.EMPLOYEE) {
      qb.andWhere('emp.id = :selfId', { selfId: actor.id });
    } else if (actor.role === EmployeeRole.MANAGER) {
      qb.andWhere('emp.managerId = :managerId', { managerId: actor.id });
    } else {
      if (query.managerId) {
        qb.andWhere('emp.managerId = :queryManagerId', {
          queryManagerId: query.managerId,
        });
      }
    }
    if (query.department) {
      qb.andWhere('emp.department = :department', {
        department: query.department,
      });
    }
    if (query.country) {
      qb.andWhere('country.name = :country', { country: query.country });
    }

    const employees = await qb.getMany();
    const year = query.year ? Number(query.year) : undefined;

    const rows = await Promise.all(
      employees.map(async (emp) => {
        try {
          const calc = await this.leaveBalancesService.calculateBalancesForEmployee(
            emp.id,
            year,
          );
          const balancesByType: Record<
            string,
            { entitlement: number; used: number; available: number }
          > = {};
          for (const b of calc.balances) {
            balancesByType[b.code] = {
              entitlement: b.entitlement,
              used: b.used,
              available: b.available,
            };
          }
          const totalAvailable = calc.balances.reduce(
            (sum, b) => sum + Number(b.available || 0),
            0,
          );
          return {
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            country: emp.country?.name ?? null,
            balances: balancesByType,
            totalAvailable,
          };
        } catch {
          // No active policy assignment (e.g. mid-transfer) — report zeroed row
          // rather than dropping the employee from the report entirely.
          return {
            employeeId: emp.id,
            employeeName: emp.fullName,
            department: emp.department,
            country: emp.country?.name ?? null,
            balances: {},
            totalAvailable: 0,
          };
        }
      }),
    );

    return rows;
  }

  // ── Overlapping Leave Report ──────────────────────────────────────────────

  async getOverlaps(actorId: string, query: ReportsQuery) {
    const actor = await this.loadActor(actorId);
    if (actor.role === EmployeeRole.EMPLOYEE) {
      throw new ForbiddenException(
        'Overlap reporting is not available for individual employees.',
      );
    }

    const now = new Date();
    const dateFrom = query.dateFrom || `${now.getFullYear()}-01-01`;
    const dateTo = query.dateTo || `${now.getFullYear()}-12-31`;

    const qb = this.requestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'emp')
      .leftJoinAndSelect('emp.country', 'country')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .andWhere('lr.status = :status', { status: LeaveRequestStatus.APPROVED });

    this.applyRequestScope(qb, actor, query);
    this.applyRequestFilters(qb, { ...query, dateFrom, dateTo, status: undefined });

    qb.orderBy('lr.startDate', 'ASC');
    const requests = await qb.getMany();

    // Merge into clusters of mutually-connected overlapping intervals
    // (interval-graph connected components), keep clusters with 2+ requests.
    const sorted = [...requests].sort((a, b) =>
      a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
    );
    const clusters: LeaveRequest[][] = [];
    let current: LeaveRequest[] = [];
    let currentEnd: string | null = null;

    for (const req of sorted) {
      if (current.length === 0) {
        current = [req];
        currentEnd = req.endDate;
        continue;
      }
      if (req.startDate <= (currentEnd as string)) {
        current.push(req);
        if (req.endDate > (currentEnd as string)) currentEnd = req.endDate;
      } else {
        if (current.length >= 2) clusters.push(current);
        current = [req];
        currentEnd = req.endDate;
      }
    }
    if (current.length >= 2) clusters.push(current);

    const clusterDtos = clusters.map((group) => ({
      startDate: group.reduce((min, r) => (r.startDate < min ? r.startDate : min), group[0].startDate),
      endDate: group.reduce((max, r) => (r.endDate > max ? r.endDate : max), group[0].endDate),
      requests: group.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee?.fullName ?? 'Unknown',
        leaveTypeName: r.leaveType?.label ?? r.leaveType?.key ?? 'Unknown',
        startDate: r.startDate,
        endDate: r.endDate,
      })),
    }));

    // Per-day concurrent-absence counts, bounded to [dateFrom, dateTo].
    const dailyCounts: { date: string; count: number }[] = [];
    const start = new Date(dateFrom + 'T00:00:00Z');
    const end = new Date(dateTo + 'T00:00:00Z');
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const count = requests.filter(
        (r) => r.startDate <= dateStr && r.endDate >= dateStr,
      ).length;
      if (count > 0) dailyCounts.push({ date: dateStr, count });
    }

    const peakConcurrent = dailyCounts.reduce((max, d) => Math.max(max, d.count), 0);
    const totalOverlapDays = dailyCounts.filter((d) => d.count >= 2).length;

    return { clusters: clusterDtos, dailyCounts, peakConcurrent, totalOverlapDays };
  }
}
