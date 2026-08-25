import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { EmployeeRole, LeaveRequestStatus } from '../../common/enums';

// Minimal chainable query-builder test double. It records the exact
// `andWhere`/`where` SQL fragments the service emits and replays them as
// predicates over an in-memory row array — this exercises the service's
// real scoping/filtering logic (not a re-implementation of it) without
// needing a live Postgres connection, matching how leave-requests.service.spec.ts
// mocks TypeORM in this codebase.
function fakeLeaveRequestQB(rows: any[]) {
  const conditions: Array<(r: any) => boolean> = [];
  const qb: any = {
    leftJoinAndSelect: () => qb,
    andWhere: (sql: string, params: any = {}) => {
      conditions.push(leaveRequestMatcher(sql, params));
      return qb;
    },
    where: (sql: string, params: any = {}) => {
      conditions.push(leaveRequestMatcher(sql, params));
      return qb;
    },
    orderBy: () => qb,
    getMany: async () => rows.filter((r) => conditions.every((c) => c(r))),
  };
  return qb;
}

function leaveRequestMatcher(sql: string, params: any): (r: any) => boolean {
  switch (sql) {
    case 'lr.employeeId = :selfId':
      return (r) => r.employeeId === params.selfId;
    case 'lr.employeeId = :employeeId':
      return (r) => r.employeeId === params.employeeId;
    case 'emp.managerId = :managerId':
      return (r) => r.employee?.managerId === params.managerId;
    case 'emp.managerId = :queryManagerId':
      return (r) => r.employee?.managerId === params.queryManagerId;
    case 'emp.department = :department':
      return (r) => r.employee?.department === params.department;
    case 'country.name = :country':
      return (r) => r.employee?.country?.name === params.country;
    case 'lr.leaveTypeId = :leaveTypeId':
      return (r) => r.leaveTypeId === params.leaveTypeId;
    case 'lr.status = :status':
      return (r) => r.status === params.status;
    case 'lr.endDate >= :dateFrom':
      return (r) => r.endDate >= params.dateFrom;
    case 'lr.startDate <= :dateTo':
      return (r) => r.startDate <= params.dateTo;
    default:
      throw new Error(`Unhandled condition in test double: ${sql}`);
  }
}

describe('ReportsService', () => {
  const admin = { id: 'admin-1', role: EmployeeRole.HR_ADMIN };
  const manager = { id: 'mgr-1', role: EmployeeRole.MANAGER };
  const otherManager = { id: 'mgr-2', role: EmployeeRole.MANAGER };
  const employee = { id: 'emp-1', role: EmployeeRole.EMPLOYEE };
  const actors: Record<string, any> = {
    [admin.id]: admin,
    [manager.id]: manager,
    [otherManager.id]: otherManager,
    [employee.id]: employee,
  };

  function baseRequest(overrides: any) {
    return {
      id: 'req-default',
      employeeId: employee.id,
      leaveTypeId: 'lt-annual',
      status: LeaveRequestStatus.APPROVED,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      createdAt: new Date(),
      employee: { managerId: manager.id, department: 'Engineering', country: { name: 'Lebanon' } },
      leaveType: { label: 'Annual Leave', key: 'annual' },
      ...overrides,
    };
  }

  function makeService(requestRows: any[], employeeRows: any[] = []) {
    const employeeRepo: any = {
      findOne: jest.fn(({ where: { id } }: any) => Promise.resolve(actors[id] ?? null)),
      createQueryBuilder: jest.fn(() => fakeLeaveRequestQB(employeeRows)),
    };
    const requestRepo: any = {
      createQueryBuilder: jest.fn(() => fakeLeaveRequestQB(requestRows)),
    };
    const leaveBalancesService: any = {
      calculateBalancesForEmployee: jest.fn(),
    };
    return new ReportsService(employeeRepo, requestRepo, leaveBalancesService);
  }

  it('throws UnauthorizedException when x-employee-id is missing or unknown', async () => {
    const service = makeService([]);
    await expect(service.getRequests('', {})).rejects.toThrow(UnauthorizedException);
    await expect(service.getRequests('does-not-exist', {})).rejects.toThrow(UnauthorizedException);
  });

  describe('getRequests scoping', () => {
    const reqFromEmp1 = baseRequest({ id: 'r1', employeeId: employee.id, employee: { managerId: manager.id, department: 'Engineering', country: { name: 'Lebanon' } } });
    const reqFromOtherTeam = baseRequest({ id: 'r2', employeeId: 'emp-2', employee: { managerId: otherManager.id, department: 'Sales', country: { name: 'France' } } });
    const rows = [reqFromEmp1, reqFromOtherTeam];

    it('HR_ADMIN sees every request company-wide', async () => {
      const service = makeService(rows);
      const result = await service.getRequests(admin.id, {});
      expect(result.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    });

    it('MANAGER only sees requests from their own direct reports', async () => {
      const service = makeService(rows);
      const result = await service.getRequests(manager.id, {});
      expect(result.map((r) => r.id)).toEqual(['r1']);
    });

    it('EMPLOYEE only sees their own requests, even if a different employeeId filter is requested', async () => {
      const service = makeService(rows);
      const result = await service.getRequests(employee.id, { employeeId: 'emp-2' });
      expect(result).toEqual([]); // scope AND filter intersect to nothing — no data leak
    });
  });

  describe('date range filtering', () => {
    const inRange = baseRequest({ id: 'in', startDate: '2026-06-01', endDate: '2026-06-05' });
    const touchingBoundary = baseRequest({ id: 'boundary', startDate: '2026-05-25', endDate: '2026-06-01' });
    const outOfRange = baseRequest({ id: 'out', startDate: '2026-07-10', endDate: '2026-07-12' });

    it('includes requests that overlap the [dateFrom, dateTo] window, inclusive at the boundary', async () => {
      const service = makeService([inRange, touchingBoundary, outOfRange]);
      const result = await service.getRequests(admin.id, { dateFrom: '2026-06-01', dateTo: '2026-06-30' });
      expect(result.map((r) => r.id).sort()).toEqual(['boundary', 'in']);
    });
  });

  describe('getOverlaps', () => {
    it('rejects EMPLOYEE callers — overlap has no meaning for a single person', async () => {
      const service = makeService([]);
      await expect(service.getOverlaps(employee.id, {})).rejects.toThrow(ForbiddenException);
    });

    it('clusters mutually-overlapping approved requests and excludes non-overlapping or pending ones', async () => {
      const a = baseRequest({ id: 'a', employeeId: 'e-a', startDate: '2026-06-01', endDate: '2026-06-10', status: LeaveRequestStatus.APPROVED });
      const b = baseRequest({ id: 'b', employeeId: 'e-b', startDate: '2026-06-05', endDate: '2026-06-15', status: LeaveRequestStatus.APPROVED });
      const c = baseRequest({ id: 'c', employeeId: 'e-c', startDate: '2026-08-01', endDate: '2026-08-05', status: LeaveRequestStatus.APPROVED });
      const pendingOverlap = baseRequest({ id: 'p', employeeId: 'e-p', startDate: '2026-06-02', endDate: '2026-06-03', status: LeaveRequestStatus.PENDING });
      const service = makeService([a, b, c, pendingOverlap]);

      const result = await service.getOverlaps(admin.id, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].requests.map((r: any) => r.id).sort()).toEqual(['a', 'b']);
      expect(result.peakConcurrent).toBe(2);
      expect(result.totalOverlapDays).toBeGreaterThan(0);
    });
  });
});
