# HR Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a designated Super Admin restrict what other HR Admin users can view/manage per module in the admin portal, enforced on both backend and frontend.

**Architecture:** A boolean `isSuperAdmin` flag on `Employee` identifies the main admin. A new `hr_permissions` table stores per-(employee, module) `canView`/`canManage` overrides (a missing row = full access). A single `PermissionGuard` + `@RequireModule(module, level)` decorator enforces this on existing controllers — for `view` it lets any non-HR_ADMIN caller through unchanged (many GET routes are shared with employee/manager self-service pages) and only restricts a non-super HR_ADMIN lacking the permission; for `manage` it requires the caller to actually be HR_ADMIN. The frontend mirrors this with a `useHrPermission(module)` hook driving sidebar filtering, route guarding, and per-page action gating, plus a new `HRPermissions.tsx` config page for the Super Admin to edit other users' access.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (backend), React + React Router + Vitest/RTL (frontend), Jest (backend tests).

**Spec:** `docs/superpowers/specs/2026-08-25-hr-permissions-design.md`

## Global Constraints

- Default access when no `hr_permissions` row exists: full (`canView: true, canManage: true`).
- Granularity: two independent booleans per module, `canView` and `canManage`.
- Super Admin is `Employee.isSuperAdmin: boolean`, not a new `role` value. Only `admin@novelus.com` gets `true`.
- Module registry (13 keys, both backend and frontend must use identical strings): `employees`, `departments`, `leaveRequests`, `leaveBalances`, `accrualHistory`, `leavePolicies`, `countries`, `publicHolidays`, `approvalLevels`, `notificationManager`, `reports`, `auditLog`, `notifications`.
- **Deviation from the spec's guard table, discovered while mapping real routes:** several GET routes thought to be admin-exclusive are actually shared with employee/manager self-service pages (`GET /employees`, `GET /employees/directory`, `GET /countries`, `GET /holidays`, `GET /reports/*`). Guarding these with a blanket `AdminGuard` would 403 regular employees using their dashboard, People directory, leave-request modal, and self-service Reports page. The fix (baked into `PermissionGuard` in Task 3, not a spec change): a `view`-level check passes through unconditionally for any caller who isn't `HR_ADMIN`, and only enforces the module permission for `HR_ADMIN` callers. A `manage`-level check always requires the caller to be `HR_ADMIN`. This preserves every existing non-admin code path untouched while still restricting a non-super HR Admin.
- `notifications` (admin analytics page) has no backend resource of its own — it reads `GET /audit-logs/global`, the same endpoint the `auditLog` page uses. Backend enforcement lives on that route under the `auditLog` module only; `notifications` is enforced frontend-only (nav/route hidden when `canView` is false).

---

### Task 1: `isSuperAdmin` column, `HrPermission` entity, module registry, migration, seed

**Files:**
- Modify: `backend/src/modules/employees/entities/employee.entity.ts`
- Create: `backend/src/common/constants/hr-modules.ts`
- Create: `backend/src/modules/hr-permissions/entities/hr-permission.entity.ts`
- Create: `backend/src/database/migrations/1787600000000-AddHrPermissions.ts`
- Modify: `backend/src/database/seeds/seed.ts`
- Test: `backend/src/common/constants/hr-modules.spec.ts`

**Interfaces:**
- Produces: `HR_MODULES: readonly HrModule[]`, `type HrModule`, `interface HrModulePermission { canView: boolean; canManage: boolean }`, `type HrPermissionMap = Record<HrModule, HrModulePermission>`, `FULL_HR_PERMISSIONS: HrPermissionMap` — used by every later backend task.
- Produces: `Employee.isSuperAdmin: boolean`.
- Produces: `HrPermission` entity with `id, employeeId, module, canView, canManage, createdAt, updatedAt`.

- [ ] **Step 1: Write the failing test for the module registry**

```ts
// backend/src/common/constants/hr-modules.spec.ts
import { HR_MODULES, FULL_HR_PERMISSIONS } from './hr-modules';

describe('hr-modules constants', () => {
  it('has one full-access entry per module', () => {
    expect(Object.keys(FULL_HR_PERMISSIONS).sort()).toEqual([...HR_MODULES].sort());
    for (const module of HR_MODULES) {
      expect(FULL_HR_PERMISSIONS[module]).toEqual({ canView: true, canManage: true });
    }
  });

  it('does not contain duplicate module keys', () => {
    expect(new Set(HR_MODULES).size).toBe(HR_MODULES.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest hr-modules.spec.ts`
Expected: FAIL with "Cannot find module './hr-modules'"

- [ ] **Step 3: Create the module registry**

```ts
// backend/src/common/constants/hr-modules.ts
export const HR_MODULES = [
  'employees',
  'departments',
  'leaveRequests',
  'leaveBalances',
  'accrualHistory',
  'leavePolicies',
  'countries',
  'publicHolidays',
  'approvalLevels',
  'notificationManager',
  'reports',
  'auditLog',
  'notifications',
] as const;

export type HrModule = (typeof HR_MODULES)[number];

export interface HrModulePermission {
  canView: boolean;
  canManage: boolean;
}

export type HrPermissionMap = Record<HrModule, HrModulePermission>;

export const FULL_HR_PERMISSIONS: HrPermissionMap = HR_MODULES.reduce(
  (acc, module) => {
    acc[module] = { canView: true, canManage: true };
    return acc;
  },
  {} as HrPermissionMap,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest hr-modules.spec.ts`
Expected: PASS

- [ ] **Step 5: Add `isSuperAdmin` to the `Employee` entity**

In `backend/src/modules/employees/entities/employee.entity.ts`, add this column (near the `role` column, after line 121's closing of the `role` property):

```ts
  @Column({ name: 'is_super_admin', type: 'boolean', default: false })
  isSuperAdmin: boolean;
```

- [ ] **Step 6: Create the `HrPermission` entity**

```ts
// backend/src/modules/hr-permissions/entities/hr-permission.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('hr_permissions')
export class HrPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ type: 'varchar', length: 50 })
  module: string;

  @Column({ name: 'can_view', type: 'boolean', default: true })
  canView: boolean;

  @Column({ name: 'can_manage', type: 'boolean', default: true })
  canManage: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 7: Write the migration by hand**

TypeORM's `migration:generate` needs a live DB connection matching the entity diff, which isn't available in this workflow — write the SQL directly, following the style of `backend/src/database/migrations/1784677005679-AddHRReviewFields.ts`.

```ts
// backend/src/database/migrations/1787600000000-AddHrPermissions.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHrPermissions1787600000000 implements MigrationInterface {
  name = 'AddHrPermissions1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "is_super_admin" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE "hr_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "employee_id" uuid NOT NULL,
        "module" character varying(50) NOT NULL,
        "can_view" boolean NOT NULL DEFAULT true,
        "can_manage" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_hr_permissions_employee_module" UNIQUE ("employee_id", "module"),
        CONSTRAINT "PK_hr_permissions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_hr_permissions_employee_id" ON "hr_permissions" ("employee_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "hr_permissions"
      ADD CONSTRAINT "FK_hr_permissions_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `UPDATE "employees" SET "is_super_admin" = true WHERE "email" = 'admin@novelus.com'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hr_permissions" DROP CONSTRAINT "FK_hr_permissions_employee"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_permissions_employee_id"`);
    await queryRunner.query(`DROP TABLE "hr_permissions"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "is_super_admin"`);
  }
}
```

- [ ] **Step 8: Update the seed script to mark the seeded admin as Super Admin**

In `backend/src/database/seeds/seed.ts`, right after the `for (const emp of employeesData) { ... }` loop closes (after line 204's loop body ends, so this runs regardless of whether the employee row was just inserted or already existed), add:

```ts
    // Grant Super Admin to the primary seeded HR Admin
    await qr.query(
      `UPDATE employees SET is_super_admin = true WHERE email = 'admin@novelus.com'`,
    );
```

- [ ] **Step 9: Run the migration against the dev database**

Run: `cd backend && npm run migration:run`
Expected: `AddHrPermissions1787600000000` reported as executed successfully, no errors.

- [ ] **Step 10: Commit**

```bash
git add backend/src/common/constants/hr-modules.ts backend/src/common/constants/hr-modules.spec.ts backend/src/modules/employees/entities/employee.entity.ts backend/src/modules/hr-permissions/entities/hr-permission.entity.ts backend/src/database/migrations/1787600000000-AddHrPermissions.ts backend/src/database/seeds/seed.ts
git commit -m "feat: add HR permissions data model (isSuperAdmin flag, hr_permissions table)"
```

---

### Task 2: `HrPermissionsService`

**Files:**
- Create: `backend/src/modules/hr-permissions/hr-permissions.service.ts`
- Test: `backend/src/modules/hr-permissions/hr-permissions.service.spec.ts`

**Interfaces:**
- Consumes: `HR_MODULES`, `HrModule`, `HrPermissionMap`, `FULL_HR_PERMISSIONS` from `../../common/constants/hr-modules` (Task 1). `HrPermission` entity, `Employee` entity.
- Produces: `HrPermissionsService.getEffectivePermissions(employeeId: string): Promise<HrPermissionMap>`, `.listHrAdmins(): Promise<Array<{id, fullName, email, isSuperAdmin, permissions: HrPermissionMap}>>`, `.setPermissions(employeeId: string, entries: SetPermissionEntry[]): Promise<HrPermissionMap>` — used by `PermissionGuard` (Task 3) and `HrPermissionsController` (Task 5). `interface SetPermissionEntry { module: HrModule; canView: boolean; canManage: boolean }`.

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/modules/hr-permissions/hr-permissions.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HrPermissionsService } from './hr-permissions.service';
import { HrPermission } from './entities/hr-permission.entity';
import { Employee } from '../employees/entities/employee.entity';
import { HR_MODULES, FULL_HR_PERMISSIONS } from '../../common/constants/hr-modules';

describe('HrPermissionsService', () => {
  let service: HrPermissionsService;
  let permissionRepo: Record<string, jest.Mock>;
  let employeeRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    permissionRepo = {
      find: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((obj: unknown) => obj),
      save: jest.fn(),
    };
    employeeRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrPermissionsService,
        { provide: getRepositoryToken(HrPermission), useValue: permissionRepo },
        { provide: getRepositoryToken(Employee), useValue: employeeRepo },
      ],
    }).compile();

    service = module.get(HrPermissionsService);
  });

  describe('getEffectivePermissions', () => {
    it('returns full access for a Super Admin regardless of stored rows', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e1', isSuperAdmin: true });
      const result = await service.getEffectivePermissions('e1');
      expect(result).toEqual(FULL_HR_PERMISSIONS);
      expect(permissionRepo.find).not.toHaveBeenCalled();
    });

    it('defaults every module to full access when no rows exist', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e2', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([]);
      const result = await service.getEffectivePermissions('e2');
      expect(result).toEqual(FULL_HR_PERMISSIONS);
    });

    it('applies a stored row as an override for its module only', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e3', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([
        { employeeId: 'e3', module: 'employees', canView: true, canManage: false },
      ]);
      const result = await service.getEffectivePermissions('e3');
      expect(result.employees).toEqual({ canView: true, canManage: false });
      expect(result.reports).toEqual({ canView: true, canManage: true });
    });

    it('throws NotFoundException for an unknown employee', async () => {
      employeeRepo.findOne.mockResolvedValue(null);
      await expect(service.getEffectivePermissions('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPermissions', () => {
    it('rejects setting permissions on a Super Admin', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e1', role: 'HR_ADMIN', isSuperAdmin: true });
      await expect(
        service.setPermissions('e1', [{ module: 'employees', canView: true, canManage: true }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects setting permissions on a non-HR_ADMIN employee', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e2', role: 'MANAGER', isSuperAdmin: false });
      await expect(
        service.setPermissions('e2', [{ module: 'employees', canView: true, canManage: true }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('replaces the full row set for the employee', async () => {
      employeeRepo.findOne
        .mockResolvedValueOnce({ id: 'e3', role: 'HR_ADMIN', isSuperAdmin: false })
        .mockResolvedValueOnce({ id: 'e3', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([
        { employeeId: 'e3', module: 'employees', canView: false, canManage: false },
      ]);

      const entries = [{ module: 'employees' as const, canView: false, canManage: false }];
      const result = await service.setPermissions('e3', entries);

      expect(permissionRepo.delete).toHaveBeenCalledWith({ employeeId: 'e3' });
      expect(permissionRepo.save).toHaveBeenCalledWith([
        { employeeId: 'e3', module: 'employees', canView: false, canManage: false },
      ]);
      expect(result.employees).toEqual({ canView: false, canManage: false });
    });

    it('rejects an unknown module key', async () => {
      employeeRepo.findOne.mockResolvedValue({ id: 'e4', role: 'HR_ADMIN', isSuperAdmin: false });
      await expect(
        service.setPermissions('e4', [
          { module: 'notAModule' as any, canView: true, canManage: true },
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listHrAdmins', () => {
    it('returns every HR_ADMIN with their effective permissions', async () => {
      employeeRepo.find.mockResolvedValue([
        { id: 'e1', fullName: 'HR Admin User', email: 'admin@novelus.com', isSuperAdmin: true },
        { id: 'e2', fullName: 'hr salim 1', email: 'salim.hizi@esprit.tn', isSuperAdmin: false },
      ]);
      employeeRepo.findOne
        .mockResolvedValueOnce({ id: 'e1', isSuperAdmin: true })
        .mockResolvedValueOnce({ id: 'e2', isSuperAdmin: false });
      permissionRepo.find.mockResolvedValue([]);

      const result = await service.listHrAdmins();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'e1', isSuperAdmin: true });
      expect(result[0].permissions).toEqual(FULL_HR_PERMISSIONS);
      expect(result[1]).toMatchObject({ id: 'e2', isSuperAdmin: false });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest hr-permissions.service.spec.ts`
Expected: FAIL with "Cannot find module './hr-permissions.service'"

- [ ] **Step 3: Implement the service**

```ts
// backend/src/modules/hr-permissions/hr-permissions.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { HrPermission } from './entities/hr-permission.entity';
import { Employee } from '../employees/entities/employee.entity';
import {
  FULL_HR_PERMISSIONS,
  HR_MODULES,
  HrModule,
  HrPermissionMap,
} from '../../common/constants/hr-modules';

export interface SetPermissionEntry {
  module: HrModule;
  canView: boolean;
  canManage: boolean;
}

export interface HrAdminListItem {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: HrPermissionMap;
}

@Injectable()
export class HrPermissionsService {
  constructor(
    @InjectRepository(HrPermission)
    private readonly permissionRepo: Repository<HrPermission>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async getEffectivePermissions(employeeId: string): Promise<HrPermissionMap> {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found.`);
    }

    if (employee.isSuperAdmin) {
      return { ...FULL_HR_PERMISSIONS };
    }

    const rows = await this.permissionRepo.find({ where: { employeeId } });
    const rowsByModule = new Map(rows.map((row) => [row.module, row]));

    const result = {} as HrPermissionMap;
    for (const module of HR_MODULES) {
      const row = rowsByModule.get(module);
      result[module] = row
        ? { canView: row.canView, canManage: row.canManage }
        : { canView: true, canManage: true };
    }
    return result;
  }

  async listHrAdmins(): Promise<HrAdminListItem[]> {
    const admins = await this.employeeRepo.find({
      where: { role: 'HR_ADMIN' as any, deletedAt: IsNull() },
      order: { fullName: 'ASC' },
    });

    return Promise.all(
      admins.map(async (admin) => ({
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
        permissions: await this.getEffectivePermissions(admin.id),
      })),
    );
  }

  async setPermissions(
    employeeId: string,
    entries: SetPermissionEntry[],
  ): Promise<HrPermissionMap> {
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, deletedAt: IsNull() },
    });
    if (!employee) {
      throw new NotFoundException(`Employee #${employeeId} not found.`);
    }
    if (employee.role !== ('HR_ADMIN' as any)) {
      throw new BadRequestException('Permissions can only be set for HR_ADMIN users.');
    }
    if (employee.isSuperAdmin) {
      throw new BadRequestException('Cannot restrict a Super Admin.');
    }

    const invalid = entries.filter((entry) => !(HR_MODULES as readonly string[]).includes(entry.module));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown module(s): ${invalid.map((entry) => entry.module).join(', ')}`,
      );
    }

    await this.permissionRepo.delete({ employeeId });

    if (entries.length > 0) {
      const rows = entries.map((entry) =>
        this.permissionRepo.create({
          employeeId,
          module: entry.module,
          canView: entry.canView,
          canManage: entry.canManage,
        }),
      );
      await this.permissionRepo.save(rows);
    }

    return this.getEffectivePermissions(employeeId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest hr-permissions.service.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/hr-permissions/hr-permissions.service.ts backend/src/modules/hr-permissions/hr-permissions.service.spec.ts
git commit -m "feat: add HrPermissionsService"
```

---

### Task 3: `@RequireModule` decorator + `PermissionGuard`

**Files:**
- Create: `backend/src/common/decorators/require-module.decorator.ts`
- Create: `backend/src/common/guards/permission.guard.ts`
- Test: `backend/src/common/guards/permission.guard.spec.ts`

**Interfaces:**
- Consumes: `HrModule` (Task 1), `HrPermissionsService.getEffectivePermissions` (Task 2), `Employee` entity.
- Produces: `RequireModule(module: HrModule, level: 'view' | 'manage')` decorator, `REQUIRE_MODULE_KEY` metadata key, `PermissionGuard` (a `CanActivate`) — consumed by every controller retrofit task (7–16) and exported from `HrPermissionsModule` (Task 5).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/common/guards/permission.guard.spec.ts
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { FULL_HR_PERMISSIONS } from '../constants/hr-modules';

function makeContext(headers: Record<string, string>, existingUser?: unknown): ExecutionContext {
  const request: any = { headers, user: existingUser };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  let reflector: { get: jest.Mock };
  let employeeRepo: { findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let hrPermissionsService: { getEffectivePermissions: jest.Mock };
  let guard: PermissionGuard;

  beforeEach(() => {
    reflector = { get: jest.fn() };
    employeeRepo = { findOne: jest.fn() };
    dataSource = { getRepository: jest.fn(() => employeeRepo) };
    hrPermissionsService = { getEffectivePermissions: jest.fn() };
    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      dataSource as any,
      hrPermissionsService as any,
    );
  });

  it('passes through when no @RequireModule metadata is present', async () => {
    reflector.get.mockReturnValue(undefined);
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(employeeRepo.findOne).not.toHaveBeenCalled();
  });

  it('allows a non-HR_ADMIN caller through a view check unconditionally', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'view' });
    employeeRepo.findOne.mockResolvedValue({ id: 'm1', role: 'MANAGER', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'm1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hrPermissionsService.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('allows a caller with no x-employee-id header through a view check', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'view' });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects a non-HR_ADMIN caller on a manage check', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    employeeRepo.findOne.mockResolvedValue({ id: 'm1', role: 'MANAGER', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'm1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('rejects a manage check with no x-employee-id header', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('always allows a Super Admin', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    employeeRepo.findOne.mockResolvedValue({ id: 'a1', role: 'HR_ADMIN', isSuperAdmin: true });
    const ctx = makeContext({ 'x-employee-id': 'a1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hrPermissionsService.getEffectivePermissions).not.toHaveBeenCalled();
  });

  it('blocks a restricted HR_ADMIN lacking the required permission', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'manage' });
    employeeRepo.findOne.mockResolvedValue({ id: 'h1', role: 'HR_ADMIN', isSuperAdmin: false });
    hrPermissionsService.getEffectivePermissions.mockResolvedValue({
      ...FULL_HR_PERMISSIONS,
      employees: { canView: true, canManage: false },
    });
    const ctx = makeContext({ 'x-employee-id': 'h1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows an HR_ADMIN with the required permission and reuses request.user if already set', async () => {
    reflector.get.mockReturnValue({ module: 'employees', level: 'view' });
    hrPermissionsService.getEffectivePermissions.mockResolvedValue(FULL_HR_PERMISSIONS);
    const ctx = makeContext({}, { id: 'h1', role: 'HR_ADMIN', isSuperAdmin: false });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(employeeRepo.findOne).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest permission.guard.spec.ts`
Expected: FAIL with "Cannot find module './permission.guard'"

- [ ] **Step 3: Implement the decorator**

```ts
// backend/src/common/decorators/require-module.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { HrModule } from '../constants/hr-modules';

export const REQUIRE_MODULE_KEY = 'requireModule';

export type PermissionLevel = 'view' | 'manage';

export interface RequireModuleMeta {
  module: HrModule;
  level: PermissionLevel;
}

export const RequireModule = (module: HrModule, level: PermissionLevel) =>
  SetMetadata(REQUIRE_MODULE_KEY, { module, level });
```

- [ ] **Step 4: Implement the guard**

```ts
// backend/src/common/guards/permission.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Employee } from '../../modules/employees/entities/employee.entity';
import { HrPermissionsService } from '../../modules/hr-permissions/hr-permissions.service';
import { REQUIRE_MODULE_KEY, RequireModuleMeta } from '../decorators/require-module.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    private readonly hrPermissionsService: HrPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<RequireModuleMeta>(REQUIRE_MODULE_KEY, context.getHandler());
    if (!meta) return true;
    const { module, level } = meta;

    const request = context.switchToHttp().getRequest();
    let employee: Employee | null = request.user ?? null;

    if (!employee) {
      const employeeId = request.headers['x-employee-id'];
      if (!employeeId) {
        if (level === 'manage') throw new UnauthorizedException('Missing x-employee-id header');
        return true;
      }

      employee = await this.dataSource.getRepository(Employee).findOne({
        where: { id: employeeId },
      });

      if (!employee) {
        if (level === 'manage') throw new UnauthorizedException('Invalid x-employee-id');
        return true;
      }
      request.user = employee;
    }

    if (employee.role !== ('HR_ADMIN' as any)) {
      if (level === 'manage') throw new ForbiddenException('Requires HR_ADMIN role');
      return true;
    }

    if (employee.isSuperAdmin) return true;

    const permissions = await this.hrPermissionsService.getEffectivePermissions(employee.id);
    const allowed = level === 'manage' ? permissions[module].canManage : permissions[module].canView;
    if (!allowed) {
      throw new ForbiddenException(`Missing ${level} permission for module "${module}"`);
    }
    return true;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest permission.guard.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/decorators/require-module.decorator.ts backend/src/common/guards/permission.guard.ts backend/src/common/guards/permission.guard.spec.ts
git commit -m "feat: add RequireModule decorator and PermissionGuard"
```

---

### Task 4: `SuperAdminGuard`

**Files:**
- Create: `backend/src/common/guards/super-admin.guard.ts`
- Test: `backend/src/common/guards/super-admin.guard.spec.ts`

**Interfaces:**
- Consumes: `Employee` entity.
- Produces: `SuperAdminGuard` — used by `HrPermissionsController` (Task 5).

- [ ] **Step 1: Write the failing tests**

```ts
// backend/src/common/guards/super-admin.guard.spec.ts
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  let employeeRepo: { findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock };
  let guard: SuperAdminGuard;

  beforeEach(() => {
    employeeRepo = { findOne: jest.fn() };
    dataSource = { getRepository: jest.fn(() => employeeRepo) };
    guard = new SuperAdminGuard(dataSource as any);
  });

  it('throws Unauthorized with no x-employee-id header', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws Unauthorized for an unknown employee id', async () => {
    employeeRepo.findOne.mockResolvedValue(null);
    const ctx = makeContext({ 'x-employee-id': 'ghost' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws Forbidden for an HR_ADMIN who is not Super Admin', async () => {
    employeeRepo.findOne.mockResolvedValue({ id: 'h1', role: 'HR_ADMIN', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'h1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws Forbidden for a non-HR_ADMIN', async () => {
    employeeRepo.findOne.mockResolvedValue({ id: 'm1', role: 'MANAGER', isSuperAdmin: false });
    const ctx = makeContext({ 'x-employee-id': 'm1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows the Super Admin through and attaches request.user', async () => {
    const admin = { id: 'a1', role: 'HR_ADMIN', isSuperAdmin: true };
    employeeRepo.findOne.mockResolvedValue(admin);
    const request: any = { headers: { 'x-employee-id': 'a1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toBe(admin);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest super-admin.guard.spec.ts`
Expected: FAIL with "Cannot find module './super-admin.guard'"

- [ ] **Step 3: Implement the guard**

```ts
// backend/src/common/guards/super-admin.guard.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest super-admin.guard.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/guards/super-admin.guard.ts backend/src/common/guards/super-admin.guard.spec.ts
git commit -m "feat: add SuperAdminGuard"
```

---

### Task 5: `HrPermissionsController`, `HrPermissionsModule`, `dev-login` response, app wiring

**Files:**
- Create: `backend/src/modules/hr-permissions/dto/set-hr-permissions.dto.ts`
- Create: `backend/src/modules/hr-permissions/hr-permissions.controller.ts`
- Create: `backend/src/modules/hr-permissions/hr-permissions.module.ts`
- Test: `backend/src/modules/hr-permissions/hr-permissions.controller.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/modules/employees/employees.service.ts` (`devLogin`)
- Test: `backend/src/modules/employees/employees.service.spec.ts` (extend)

**Interfaces:**
- Consumes: `HrPermissionsService` (Task 2), `SuperAdminGuard` (Task 4), `PermissionGuard` (Task 3), `HR_MODULES`/`HrModule` (Task 1).
- Produces: routes `GET /hr-permissions`, `GET /hr-permissions/:employeeId`, `PUT /hr-permissions/:employeeId`. `HrPermissionsModule` exports `HrPermissionsService` and `PermissionGuard` — every controller retrofit task (7–16) imports this module. `devLogin` response gains `isSuperAdmin: boolean` and `permissions: HrPermissionMap`.

- [ ] **Step 1: Write the failing controller test**

```ts
// backend/src/modules/hr-permissions/hr-permissions.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HrPermissionsController } from './hr-permissions.controller';
import { HrPermissionsService } from './hr-permissions.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

describe('HrPermissionsController', () => {
  let controller: HrPermissionsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      listHrAdmins: jest.fn(),
      getEffectivePermissions: jest.fn(),
      setPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HrPermissionsController],
      providers: [
        { provide: HrPermissionsService, useValue: service },
        { provide: DataSource, useValue: {} },
        SuperAdminGuard,
      ],
    }).compile();

    controller = module.get(HrPermissionsController);
  });

  it('lists HR admins', async () => {
    service.listHrAdmins.mockResolvedValue([{ id: 'e1' }]);
    expect(await controller.listHrAdmins()).toEqual([{ id: 'e1' }]);
  });

  it('gets one employee permissions', async () => {
    service.getEffectivePermissions.mockResolvedValue({});
    await controller.getPermissions('e1');
    expect(service.getEffectivePermissions).toHaveBeenCalledWith('e1');
  });

  it('sets permissions', async () => {
    const dto = { permissions: [{ module: 'employees' as const, canView: true, canManage: false }] };
    service.setPermissions.mockResolvedValue({});
    await controller.setPermissions('e1', dto);
    expect(service.setPermissions).toHaveBeenCalledWith('e1', dto.permissions);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest hr-permissions.controller.spec.ts`
Expected: FAIL with "Cannot find module './hr-permissions.controller'"

- [ ] **Step 3: Implement the DTO**

```ts
// backend/src/modules/hr-permissions/dto/set-hr-permissions.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, ValidateNested } from 'class-validator';
import { HR_MODULES, HrModule } from '../../../common/constants/hr-modules';

export class HrPermissionEntryDto {
  @IsIn(HR_MODULES)
  module: HrModule;

  @IsBoolean()
  canView: boolean;

  @IsBoolean()
  canManage: boolean;
}

export class SetHrPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrPermissionEntryDto)
  permissions: HrPermissionEntryDto[];
}
```

- [ ] **Step 4: Implement the controller**

```ts
// backend/src/modules/hr-permissions/hr-permissions.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrPermissionsService } from './hr-permissions.service';
import { SetHrPermissionsDto } from './dto/set-hr-permissions.dto';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@ApiTags('HR Permissions')
@Controller({ path: 'hr-permissions', version: '1' })
@UseGuards(SuperAdminGuard)
export class HrPermissionsController {
  constructor(private readonly service: HrPermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List HR Admin users with effective permissions (Super Admin only)' })
  listHrAdmins() {
    return this.service.listHrAdmins();
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'Get effective permissions for one HR Admin user (Super Admin only)' })
  getPermissions(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.service.getEffectivePermissions(employeeId);
  }

  @Put(':employeeId')
  @ApiOperation({ summary: 'Replace permissions for one HR Admin user (Super Admin only)' })
  setPermissions(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SetHrPermissionsDto,
  ) {
    return this.service.setPermissions(employeeId, dto.permissions);
  }
}
```

- [ ] **Step 5: Implement the module**

```ts
// backend/src/modules/hr-permissions/hr-permissions.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrPermission } from './entities/hr-permission.entity';
import { Employee } from '../employees/entities/employee.entity';
import { HrPermissionsService } from './hr-permissions.service';
import { HrPermissionsController } from './hr-permissions.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([HrPermission, Employee])],
  controllers: [HrPermissionsController],
  providers: [HrPermissionsService, PermissionGuard],
  exports: [HrPermissionsService, PermissionGuard],
})
export class HrPermissionsModule {}
```

- [ ] **Step 6: Register the module in `app.module.ts`**

Add the import and the entry in the `imports` array (`backend/src/app.module.ts`):

```ts
import { HrPermissionsModule } from './modules/hr-permissions/hr-permissions.module';
```

```ts
    LeaveRemindersModule,
    HrPermissionsModule,
  ],
```

- [ ] **Step 7: Run the controller test to verify it passes**

Run: `cd backend && npx jest hr-permissions.controller.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Extend `devLogin` to include Super Admin status and permissions**

In `backend/src/modules/employees/employees.service.ts`, `devLogin` needs the effective permissions. Inject `HrPermissionsService`:

```ts
import { HrPermissionsService } from '../hr-permissions/hr-permissions.service';
```

Add it to the constructor (alongside the existing injected repos/services):

```ts
    private readonly hrPermissionsService: HrPermissionsService,
```

Replace the `devLogin` method body:

```ts
  async devLogin(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const employee = await this.employeeRepo.findOne({
      where: { email: normalizedEmail, deletedAt: IsNull() },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with email ${normalizedEmail} not found`);
    }
    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException(`Employee ${normalizedEmail} is not active`);
    }

    const isAdmin = employee.role === 'HR_ADMIN';

    return {
      id: employee.id,
      name: employee.fullName,
      email: employee.email,
      role: isAdmin ? 'admin' : (employee.role === 'MANAGER' ? 'manager' : 'employee'),
      avatar: employee.avatar || employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase(),
      isSuperAdmin: isAdmin ? employee.isSuperAdmin : false,
      permissions: isAdmin ? await this.hrPermissionsService.getEffectivePermissions(employee.id) : undefined,
    };
  }
```

- [ ] **Step 9: Wire `HrPermissionsModule` into `EmployeesModule`**

In `backend/src/modules/employees/employees.module.ts`, add the import so `HrPermissionsService` is injectable into `EmployeesService`:

```ts
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';
```

```ts
  imports: [
    TypeOrmModule.forFeature([...]),
    LeaveBalancesModule,
    AuditLogsModule,
    HrPermissionsModule,
  ],
```

- [ ] **Step 10: Extend the `devLogin` unit test**

In `backend/src/modules/employees/employees.service.spec.ts`, add `HrPermissionsService` to the test module's providers (alongside the existing mocks) and a test for the new fields:

```ts
        {
          provide: HrPermissionsService,
          useValue: { getEffectivePermissions: jest.fn().mockResolvedValue({}) },
        },
```

```ts
  describe('devLogin', () => {
    it('includes isSuperAdmin and permissions for an HR_ADMIN', async () => {
      employeeRepo.findOne.mockResolvedValue({
        id: 'e1',
        fullName: 'HR Admin User',
        email: 'admin@novelus.com',
        role: 'HR_ADMIN',
        status: EmployeeStatus.ACTIVE,
        isSuperAdmin: true,
        avatar: null,
      });
      const result = await service.devLogin('admin@novelus.com');
      expect(result.role).toBe('admin');
      expect(result.isSuperAdmin).toBe(true);
      expect(result.permissions).toEqual({});
    });

    it('omits permissions for a non-admin employee', async () => {
      employeeRepo.findOne.mockResolvedValue({
        id: 'e2',
        fullName: 'Gabriel Habre',
        email: 'gabriel@novelus.com',
        role: 'MANAGER',
        status: EmployeeStatus.ACTIVE,
        isSuperAdmin: false,
        avatar: null,
      });
      const result = await service.devLogin('gabriel@novelus.com');
      expect(result.isSuperAdmin).toBe(false);
      expect(result.permissions).toBeUndefined();
    });
  });
```

Add the import at the top of the spec file:

```ts
import { HrPermissionsService } from '../hr-permissions/hr-permissions.service';
```

- [ ] **Step 11: Run all affected tests**

Run: `cd backend && npx jest hr-permissions employees.service.spec.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add backend/src/modules/hr-permissions backend/src/app.module.ts backend/src/modules/employees/employees.service.ts backend/src/modules/employees/employees.module.ts backend/src/modules/employees/employees.service.spec.ts
git commit -m "feat: add HR Permissions API and extend dev-login with permission data"
```

---

### Task 6: Retrofit `employees.controller.ts`

**Files:**
- Modify: `backend/src/modules/employees/employees.controller.ts`
- Modify: `backend/src/modules/employees/employees.controller.spec.ts` (create if it doesn't exist — check first)

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3).

- [ ] **Step 1: Check for an existing controller spec**

Run: `ls backend/src/modules/employees/employees.controller.spec.ts 2>/dev/null || echo "none"`

If it doesn't exist, create a minimal one in Step 4. If it exists, extend it in Step 4 instead of creating.

- [ ] **Step 2: Add guards to the controller's view and manage routes**

In `backend/src/modules/employees/employees.controller.ts`, add the imports:

```ts
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

(`UseGuards` is likely already imported for other reasons in this file — check the existing `@nestjs/common` import list and add `UseGuards` to it if missing rather than duplicating the import line.)

Apply guards per route, leaving `dev-login`, `me`, `me/leave-balances`, `Patch me` untouched:

```ts
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
```

```ts
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
```

- [ ] **Step 3: Wire `HrPermissionsModule` for DI**

`employees.module.ts` already imports `HrPermissionsModule` from Task 5, Step 9 — no further change needed here.

- [ ] **Step 4: Write/extend the controller spec to prove the guards are wired**

If `employees.controller.spec.ts` doesn't already exist, create it:

```ts
// backend/src/modules/employees/employees.controller.spec.ts
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
```

If the file already exists (per Step 1), instead add the two `it('requires ... permission ...')` tests above to its existing `describe` block, and add `HrPermissionsService`, `PermissionGuard`, and `Reflector` to its provider list.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest employees.controller.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/employees/employees.controller.ts backend/src/modules/employees/employees.controller.spec.ts
git commit -m "feat: enforce HR permissions on the employees controller"
```

---

### Task 7: Retrofit `leave-requests.controller.ts` (HR routes)

**Files:**
- Modify: `backend/src/modules/leave-requests/leave-requests.controller.ts`
- Modify: `backend/src/modules/leave-requests/leave-requests.module.ts`
- Modify: `backend/src/modules/leave-requests/leave-requests.controller.spec.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

- [ ] **Step 1: Add `HrPermissionsModule` to the module's imports**

In `backend/src/modules/leave-requests/leave-requests.module.ts`, add:

```ts
import { HrPermissionsModule } from '../hr-permissions/hr-permissions.module';
```

and add `HrPermissionsModule` to the `imports` array.

- [ ] **Step 2: Add `RequireModule` to the four `hr/*` routes**

In `backend/src/modules/leave-requests/leave-requests.controller.ts`, add the imports:

```ts
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

Update the four HR routes — `hr`, `hr/:id/approve`, `hr/:id/reject`, `hr/:id/delete` (verified in `backend/src/modules/leave-requests/leave-requests.controller.ts`):

```ts
  @Get('hr')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leaveRequests', 'view')
  @ApiOperation({ summary: 'Get all leave requests for HR' })
  hrFindAll(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.hrFindAll(query, actorId);
  }

  @Put('hr/:id/approve')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leaveRequests', 'manage')
  @ApiOperation({ summary: 'Approve a leave request directly (HR Override)' })
  hrApprove(
    @Headers('x-employee-id') reviewerId: string,
    @Param('id') id: string,
  ) {
    if (!reviewerId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.hrApprove(id, reviewerId);
  }

  @Put('hr/:id/reject')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leaveRequests', 'manage')
  @ApiOperation({ summary: 'Reject a leave request directly (HR Override)' })
  hrReject(
    @Headers('x-employee-id') reviewerId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    if (!reviewerId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.hrReject(id, reviewerId, reason);
  }

  @Put('hr/:id/delete')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leaveRequests', 'manage')
  @ApiOperation({ summary: 'HR deletes a leave request regardless of status; kept visible as DELETED_BY_HR' })
  hrDelete(
    @Headers('x-employee-id') actorId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.hrDelete(id, actorId, reason);
  }
```

- [ ] **Step 3: Extend the controller spec**

In `backend/src/modules/leave-requests/leave-requests.controller.spec.ts`, add `PermissionGuard`, `HrPermissionsService`, and `Reflector` to the providers (mirroring Task 6 Step 4) and one assertion:

```ts
        PermissionGuard,
        Reflector,
        { provide: HrPermissionsService, useValue: {} },
```

```ts
  it('requires view permission on hrFindAll', () => {
    const meta = Reflect.getMetadata(REQUIRE_MODULE_KEY, controller.hrFindAll);
    expect(meta).toEqual({ module: 'leaveRequests', level: 'view' });
  });
```

Add the matching imports at the top: `Reflector` from `@nestjs/core`, `PermissionGuard` from `../../common/guards/permission.guard`, `HrPermissionsService` from `../hr-permissions/hr-permissions.service`, `REQUIRE_MODULE_KEY` from `../../common/decorators/require-module.decorator`.

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest leave-requests.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/leave-requests/leave-requests.controller.ts backend/src/modules/leave-requests/leave-requests.module.ts backend/src/modules/leave-requests/leave-requests.controller.spec.ts
git commit -m "feat: enforce HR permissions on leave-requests HR routes"
```

---

### Task 8: Retrofit `leave-balances.controller.ts` and `leave-ledger.controller.ts`

**Files:**
- Modify: `backend/src/modules/leave-balances/leave-balances.controller.ts`
- Modify: `backend/src/modules/leave-balances/leave-ledger.controller.ts`
- Modify: `backend/src/modules/leave-balances/leave-balances.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

- [ ] **Step 1: Add `HrPermissionsModule` to the module's imports**

In `backend/src/modules/leave-balances/leave-balances.module.ts`, import and add `HrPermissionsModule` to `imports` (same pattern as Task 7 Step 1). Watch for a circular import: `HrPermissionsModule` does not import `LeaveBalancesModule`, so this is safe.

- [ ] **Step 2: Guard `leave-balances.controller.ts` (module `leaveBalances`)**

```ts
import { UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Get('ledger')
  @UseGuards(PermissionGuard)
  @RequireModule('leaveBalances', 'view')
  @ApiOperation({
    summary: 'Query immutable leave ledger entries (audit history)',
  })
  findAllLedger(@Query() query: LedgerQueryDto) {
    return this.service.findAllLedger(query);
  }

  @Get('employee/:employeeId')
  @UseGuards(PermissionGuard)
  @RequireModule('leaveBalances', 'view')
  @ApiOperation({ summary: 'Get calculated balance records for a given employee' })
  findByEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('year') year?: number,
  ) {
    return this.service.calculateBalancesForEmployee(
      employeeId,
      year ? Number(year) : undefined,
    );
  }

  @Post('adjust')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leaveBalances', 'manage')
  @ApiOperation({
    summary: 'Perform an atomic manual balance adjustment with ledger entry',
  })
  adjust(@Body() dto: AdjustBalanceDto) {
    return this.service.adjust(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('leaveBalances', 'view')
  @ApiOperation({ summary: 'List leave balances with pagination and filters' })
  findAll(@Query() query: BalanceQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('leaveBalances', 'view')
  @ApiOperation({ summary: 'Get leave balance detail by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
```

- [ ] **Step 3: Guard `leave-ledger.controller.ts` (module `accrualHistory`, view-only)**

```ts
import { UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Get('history')
  @UseGuards(PermissionGuard)
  @RequireModule('accrualHistory', 'view')
  @ApiOperation({
    summary: 'Get accrual history of all leave transaction records',
  })
  getHistory(@Query() query: LedgerHistoryQueryDto) {
    return this.service.getLedgerHistory(query);
  }
```

- [ ] **Step 4: Verify existing tests still pass (no leave-balances controller spec exists today, per the earlier file scan — skip creating one unless the codebase already had one; check first)**

Run: `ls backend/src/modules/leave-balances/*.controller.spec.ts 2>/dev/null || echo "none"`

If any exist, add the same `Reflect.getMetadata(REQUIRE_MODULE_KEY, ...)` assertion pattern as Task 6 Step 4 for `findAll` (view) and `adjust` (manage). If none exist, this step is a no-op — don't invent new spec files for controllers that never had one; rely on the compile-time check in Step 5.

- [ ] **Step 5: Verify the project still compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/leave-balances
git commit -m "feat: enforce HR permissions on leave-balances and leave-ledger controllers"
```

---

### Task 9: Retrofit `policies.controller.ts`

**Files:**
- Modify: `backend/src/modules/policies/policies.controller.ts`
- Modify: `backend/src/modules/policies/policies.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

- [ ] **Step 1: Add `HrPermissionsModule` to `policies.module.ts`'s imports**

Same pattern as Task 7 Step 1.

- [ ] **Step 2: Guard every route (module `leavePolicies`)**

```ts
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leavePolicies', 'manage')
  @ApiOperation({
    summary: 'Create a leave policy with rules and milestones (atomic)',
  })
  create(@Body() dto: CreatePolicyDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('leavePolicies', 'view')
  @ApiOperation({
    summary: 'List policies with pagination, search, and filters',
  })
  findAll(@Query() query: PolicyQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('leavePolicies', 'view')
  @ApiOperation({
    summary: 'Get full policy detail (frontend-compatible shape)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leavePolicies', 'manage')
  @ApiOperation({
    summary: 'Update policy atomically (replaces rules/milestones)',
  })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePolicyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('leavePolicies', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a policy' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 3: Verify compile**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/policies
git commit -m "feat: enforce HR permissions on the policies controller"
```

---

### Task 10: Retrofit `countries.controller.ts`

**Files:**
- Modify: `backend/src/modules/countries/countries.controller.ts`
- Modify: `backend/src/modules/countries/countries.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

**Note:** `GET /countries` is consumed by the plain employee dashboard widget (`UpcomingHolidays.tsx`), not only the admin portal. Only `PermissionGuard` (no `AdminGuard`) goes on the GET routes — its `view`-level check passes non-HR_ADMIN callers through unconditionally (see Global Constraints), so this stays safe for that widget.

- [ ] **Step 1: Add `HrPermissionsModule` to `countries.module.ts`'s imports**

- [ ] **Step 2: Guard routes (module `countries`)**

```ts
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

The file's actual routes (verified in `backend/src/modules/countries/countries.controller.ts`) are `create` (`CreateCountryDto`), `findAll` (`PaginationQueryDto`), `findOne`, `update` (`UpdateCountryDto`), `remove`. Add guards without changing any parameter or DTO:

```ts
  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('countries', 'manage')
  @ApiOperation({ summary: 'Create a country' })
  create(@Body() dto: CreateCountryDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('countries', 'view')
  @ApiOperation({ summary: 'List countries with pagination and search' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('countries', 'view')
  @ApiOperation({ summary: 'Get a country by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('countries', 'manage')
  @ApiOperation({ summary: 'Update a country' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCountryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('countries', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a country' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 3: Verify compile**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/countries
git commit -m "feat: enforce HR permissions on the countries controller"
```

---

### Task 11: Retrofit `public-holidays.controller.ts`

**Files:**
- Modify: `backend/src/modules/public-holidays/public-holidays.controller.ts`
- Modify: `backend/src/modules/public-holidays/public-holidays.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

**Note:** Same as Task 10 — `GET /holidays` is consumed by `UpcomingHolidays.tsx` on the employee dashboard. Only `PermissionGuard` on the GET routes.

- [ ] **Step 1: Add `HrPermissionsModule` to `public-holidays.module.ts`'s imports**

- [ ] **Step 2: Guard routes (module `publicHolidays`)**

The file's actual routes (verified in `backend/src/modules/public-holidays/public-holidays.controller.ts`) are `create` (`CreatePublicHolidayDto`), `findAll` (`HolidayQueryDto`), `findOne`, `update` (`UpdatePublicHolidayDto`), `remove`. Add the imports:

```ts
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('publicHolidays', 'manage')
  @ApiOperation({ summary: 'Create a public holiday' })
  create(@Body() dto: CreatePublicHolidayDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('publicHolidays', 'view')
  @ApiOperation({
    summary: 'List holidays; pass year to project recurring holidays',
  })
  findAll(@Query() query: HolidayQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('publicHolidays', 'view')
  @ApiOperation({ summary: 'Get a holiday by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('publicHolidays', 'manage')
  @ApiOperation({ summary: 'Update a holiday' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePublicHolidayDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('publicHolidays', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard-delete a public holiday' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 3: Verify compile**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/public-holidays
git commit -m "feat: enforce HR permissions on the public-holidays controller"
```

---

### Task 12: Retrofit `departments.controller.ts`

**Files:**
- Modify: `backend/src/modules/departments/departments.controller.ts`
- Modify: `backend/src/modules/departments/departments.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

**Note:** No non-admin frontend usage was found for `departmentsApi` — safe to guard the GET routes with `PermissionGuard` alone (consistent with the rest; harmless either way since nobody else calls it).

- [ ] **Step 1: Add `HrPermissionsModule` to `departments.module.ts`'s imports**

- [ ] **Step 2: Guard routes (module `departments`)**

The file's actual routes (verified in `backend/src/modules/departments/departments.controller.ts`) are `create` (`CreateDepartmentDto`), `findAll` (`PaginationQueryDto`), `findOne`, `update` (`UpdateDepartmentDto`), `remove`. Add the imports:

```ts
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('departments', 'manage')
  @ApiOperation({ summary: 'Create a department' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('departments', 'view')
  @ApiOperation({ summary: 'List departments' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('departments', 'view')
  @ApiOperation({ summary: 'Get a department by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('departments', 'manage')
  @ApiOperation({ summary: 'Update a department' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('departments', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a department' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
```

- [ ] **Step 3: Verify compile**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/departments
git commit -m "feat: enforce HR permissions on the departments controller"
```

---

### Task 13: Retrofit `approval-workflows.controller.ts`

**Files:**
- Modify: `backend/src/modules/approval-workflows/approval-workflows.controller.ts`
- Modify: `backend/src/modules/approval-workflows/approval-workflows.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

- [ ] **Step 1: Add `HrPermissionsModule` to `approval-workflows.module.ts`'s imports**

- [ ] **Step 2: Guard routes (module `approvalLevels`)**

The file's actual routes (verified in `backend/src/modules/approval-workflows/approval-workflows.controller.ts`) already take `actorId` via `@Headers('x-employee-id')` for `create`/`update`/`remove` with their own `UnauthorizedException` check — leave that check as-is, just add the guard/decorator lines above it. Add the imports:

```ts
import { PermissionGuard } from '../../common/guards/permission.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Post()
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('approvalLevels', 'manage')
  @ApiOperation({ summary: 'Create a workflow with steps' })
  create(
    @Headers('x-employee-id') actorId: string,
    @Body() dto: CreateApprovalWorkflowDto,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.create(dto, actorId);
  }

  @Get('resolve')
  @UseGuards(PermissionGuard)
  @RequireModule('approvalLevels', 'view')
  @ApiOperation({ summary: 'Resolve a workflow by country, leave type, and effective date' })
  resolve(
    @Query('countryId', ParseUUIDPipe) countryId: string,
    @Query('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
    @Query('effectiveDate') effectiveDate: string,
  ) {
    return this.service.resolveWorkflow(countryId, leaveTypeId, effectiveDate);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequireModule('approvalLevels', 'view')
  @ApiOperation({ summary: 'List workflows with steps' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @RequireModule('approvalLevels', 'view')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('approvalLevels', 'manage')
  @ApiOperation({
    summary: 'Update a workflow and replace its steps atomically',
  })
  update(
    @Headers('x-employee-id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApprovalWorkflowDto,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.update(id, dto, actorId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('approvalLevels', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workflow' })
  remove(
    @Headers('x-employee-id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!actorId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.remove(id, actorId);
  }
```

Note `create`/`update`/`remove` already require `AdminGuard` behavior via their manual `actorId` check — adding `AdminGuard` here formalizes it consistently with the rest of the codebase (the manual check can stay; it's now redundant but harmless).

- [ ] **Step 3: Verify compile**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/approval-workflows
git commit -m "feat: enforce HR permissions on the approval-workflows controller"
```

---

### Task 14: Retrofit `reports.controller.ts`

**Files:**
- Modify: `backend/src/modules/reports/reports.controller.ts`
- Modify: `backend/src/modules/reports/reports.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

**Note:** All three routes are read-only and shared with the employee self-service Reports page — `view`-level `PermissionGuard` only, no `manage` level exists for this module (matches the spec's "read-only resource" note).

- [ ] **Step 1: Add `HrPermissionsModule` to `reports.module.ts`'s imports**

- [ ] **Step 2: Guard the three routes (module `reports`)**

```ts
import { UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

The file's actual routes (verified in `backend/src/modules/reports/reports.controller.ts`) are `getRequests`, `getBalances`, `getOverlaps`, each already scoping data server-side by the caller's role via `actorId` — exactly the shared-route case `PermissionGuard`'s view-level pass-through is designed for:

```ts
  @Get('requests')
  @UseGuards(PermissionGuard)
  @RequireModule('reports', 'view')
  @ApiOperation({
    summary:
      'Leave requests report, scoped server-side by caller role (HR_ADMIN: company-wide, MANAGER: direct reports, EMPLOYEE: self only)',
  })
  getRequests(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.getRequests(actorId, query);
  }

  @Get('balances')
  @UseGuards(PermissionGuard)
  @RequireModule('reports', 'view')
  @ApiOperation({
    summary: 'Leave balances report, scoped server-side by caller role',
  })
  getBalances(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.getBalances(actorId, query);
  }

  @Get('overlaps')
  @UseGuards(PermissionGuard)
  @RequireModule('reports', 'view')
  @ApiOperation({
    summary:
      'Overlapping approved leave report, scoped server-side by caller role (not available to EMPLOYEE callers)',
  })
  getOverlaps(
    @Headers('x-employee-id') actorId: string,
    @Query() query: any,
  ) {
    return this.service.getOverlaps(actorId, query);
  }
```

- [ ] **Step 3: Verify compile**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/reports
git commit -m "feat: enforce HR view permission on the reports controller"
```

---

### Task 15: Retrofit `leave-reminders.controller.ts` and `audit-logs.controller.ts`

**Files:**
- Modify: `backend/src/modules/leave-reminders/leave-reminders.controller.ts`
- Modify: `backend/src/modules/leave-reminders/leave-reminders.module.ts`
- Modify: `backend/src/modules/audit-logs/audit-logs.controller.ts`
- Modify: `backend/src/modules/audit-logs/audit-logs.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard`, `RequireModule` (Task 3), `HrPermissionsModule` (Task 5).

- [ ] **Step 1: Add `HrPermissionsModule` to both modules' imports**

- [ ] **Step 2: Guard `leave-reminders.controller.ts` (module `notificationManager`)**

This controller already has `@UseGuards(AdminGuard)` at the class level, so every route is already HR_ADMIN-only. Add per-route `PermissionGuard` + `RequireModule` on top:

```ts
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Get('settings')
  @UseGuards(PermissionGuard)
  @RequireModule('notificationManager', 'view')
  @ApiOperation({ summary: 'Get pending-approval reminder settings' })
  getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  @UseGuards(PermissionGuard)
  @RequireModule('notificationManager', 'manage')
  @ApiOperation({ summary: 'Update pending-approval reminder settings' })
  updateSettings(
    @Body() dto: UpdateReminderSettingsDto,
    @Headers('x-employee-id') actorId: string,
  ) {
    return this.service.updateSettings(dto, actorId);
  }

  @Get('history')
  @UseGuards(PermissionGuard)
  @RequireModule('notificationManager', 'view')
  @ApiOperation({ summary: 'Get sent reminder notification history' })
  getHistory(@Query('limit') limit?: string) {
    return this.service.getHistory(limit ? parseInt(limit, 10) : undefined);
  }

  @Post('run')
  @UseGuards(PermissionGuard)
  @RequireModule('notificationManager', 'manage')
  @ApiOperation({ summary: 'Manually trigger the reminder check now' })
  runNow() {
    return this.service.runReminderCheck();
  }
```

Since the class-level `@UseGuards(AdminGuard)` already ran first, `request.user` is already populated when `PermissionGuard` runs — it reuses it without a second DB lookup (see Task 3's guard implementation).

- [ ] **Step 3: Guard `audit-logs.controller.ts`'s `global` route only (module `auditLog`)**

`my-notifications` and `history` are self-service routes used by every employee — leave them untouched. Only `global` is admin-only:

```ts
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
```

```ts
  @Get('global')
  @UseGuards(AdminGuard, PermissionGuard)
  @RequireModule('auditLog', 'view')
  @ApiOperation({ summary: 'Get all audit logs (HR only)' })
  findAll(
    @Query('entityType') entityType?: string,
    @Query('actionType') actionType?: AuditActionType,
  ) {
    return this.service.findAll({ entityType, actionType });
  }
```

(No `manage` level exists for `auditLog` — it's read-only, matching the spec.)

- [ ] **Step 4: Verify compile**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/leave-reminders backend/src/modules/audit-logs
git commit -m "feat: enforce HR permissions on notification manager and audit log routes"
```

---

### Task 16: Frontend HR permission types, hook, and API client

**Files:**
- Create: `frontend/src/admin/types/hrPermissions.ts`
- Create: `frontend/src/admin/utils/useHrPermissions.ts`
- Create: `frontend/src/services/hrPermissionsApi.ts`
- Test: `frontend/src/admin/utils/useHrPermissions.test.ts`

**Interfaces:**
- Produces: `HR_MODULES`, `type HrModule`, `HrPermissionMap`, `FULL_HR_PERMISSIONS`, `HR_MODULE_LABELS` (types file). `getCurrentUser()`, `useHrPermission(module): {canView, canManage}`, `isSuperAdmin(): boolean` (hook file). `getHrAdmins()`, `getHrPermissions(employeeId)`, `setHrPermissions(employeeId, entries)` (API file) — consumed by every remaining frontend task (17–21).

- [ ] **Step 1: Write the failing hook test**

```ts
// frontend/src/admin/utils/useHrPermissions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHrPermission, getCurrentUser, isSuperAdmin } from './useHrPermissions';
import { FULL_HR_PERMISSIONS } from '../types/hrPermissions';

describe('useHrPermissions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to full access when there is no stored user', () => {
    const { result } = renderHook(() => useHrPermission('employees'));
    expect(result.current).toEqual({ canView: true, canManage: true });
  });

  it('returns full access for a Super Admin regardless of stored permissions', () => {
    localStorage.setItem('currentUser', JSON.stringify({ isSuperAdmin: true, permissions: { employees: { canView: false, canManage: false } } }));
    const { result } = renderHook(() => useHrPermission('employees'));
    expect(result.current).toEqual({ canView: true, canManage: true });
  });

  it('returns the stored permission for a restricted HR admin', () => {
    localStorage.setItem('currentUser', JSON.stringify({
      isSuperAdmin: false,
      permissions: { ...FULL_HR_PERMISSIONS, employees: { canView: true, canManage: false } },
    }));
    const { result } = renderHook(() => useHrPermission('employees'));
    expect(result.current).toEqual({ canView: true, canManage: false });
  });

  it('isSuperAdmin reads the stored flag', () => {
    localStorage.setItem('currentUser', JSON.stringify({ isSuperAdmin: true }));
    expect(isSuperAdmin()).toBe(true);
  });

  it('getCurrentUser tolerates malformed JSON', () => {
    localStorage.setItem('currentUser', '{not json');
    expect(getCurrentUser()).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run useHrPermissions.test.ts`
Expected: FAIL with "Cannot find module './useHrPermissions'"

- [ ] **Step 3: Implement the types file**

```ts
// frontend/src/admin/types/hrPermissions.ts
export const HR_MODULES = [
  'employees',
  'departments',
  'leaveRequests',
  'leaveBalances',
  'accrualHistory',
  'leavePolicies',
  'countries',
  'publicHolidays',
  'approvalLevels',
  'notificationManager',
  'reports',
  'auditLog',
  'notifications',
] as const;

export type HrModule = (typeof HR_MODULES)[number];

export interface HrModulePermission {
  canView: boolean;
  canManage: boolean;
}

export type HrPermissionMap = Record<HrModule, HrModulePermission>;

export const FULL_HR_PERMISSIONS: HrPermissionMap = HR_MODULES.reduce((acc, module) => {
  acc[module] = { canView: true, canManage: true };
  return acc;
}, {} as HrPermissionMap);

export const HR_MODULE_LABELS: Record<HrModule, string> = {
  employees: 'Employees',
  departments: 'Departments',
  leaveRequests: 'Leave Requests',
  leaveBalances: 'Leave Balances',
  accrualHistory: 'Accrual History',
  leavePolicies: 'Leave Policies',
  countries: 'Countries',
  publicHolidays: 'Public Holidays',
  approvalLevels: 'Approval Levels',
  notificationManager: 'Notification Manager',
  reports: 'Reports',
  auditLog: 'Audit Log',
  notifications: 'Notifications',
};
```

- [ ] **Step 4: Implement the hook**

```ts
// frontend/src/admin/utils/useHrPermissions.ts
import { useMemo } from 'react';
import type { HrModule, HrPermissionMap } from '../types/hrPermissions';
import { FULL_HR_PERMISSIONS } from '../types/hrPermissions';

interface StoredUser {
  isSuperAdmin?: boolean;
  permissions?: HrPermissionMap;
}

export function getCurrentUser(): StoredUser {
  try {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function isSuperAdmin(): boolean {
  return !!getCurrentUser().isSuperAdmin;
}

export function useHrPermission(module: HrModule): { canView: boolean; canManage: boolean } {
  return useMemo(() => {
    const user = getCurrentUser();
    if (user.isSuperAdmin) return { canView: true, canManage: true };
    return user.permissions?.[module] ?? FULL_HR_PERMISSIONS[module];
  }, [module]);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run useHrPermissions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Implement the API client**

```ts
// frontend/src/services/hrPermissionsApi.ts
import { apiFetch } from './apiClient';
import type { HrModule, HrPermissionMap } from '../admin/types/hrPermissions';

export interface HrAdminListItem {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: HrPermissionMap;
}

export interface HrPermissionEntry {
  module: HrModule;
  canView: boolean;
  canManage: boolean;
}

export async function getHrAdmins(signal?: AbortSignal): Promise<HrAdminListItem[]> {
  return apiFetch<HrAdminListItem[]>('/hr-permissions', { signal });
}

export async function getHrPermissions(
  employeeId: string,
  signal?: AbortSignal,
): Promise<HrPermissionMap> {
  return apiFetch<HrPermissionMap>(`/hr-permissions/${employeeId}`, { signal });
}

export async function setHrPermissions(
  employeeId: string,
  permissions: HrPermissionEntry[],
): Promise<HrPermissionMap> {
  return apiFetch<HrPermissionMap>(`/hr-permissions/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/admin/types/hrPermissions.ts frontend/src/admin/utils/useHrPermissions.ts frontend/src/admin/utils/useHrPermissions.test.ts frontend/src/services/hrPermissionsApi.ts
git commit -m "feat: add frontend HR permission types, hook, and API client"
```

---

### Task 17: `AdminSidebar` filtering and HR Permissions nav item

**Files:**
- Modify: `frontend/src/admin/components/layout/AdminSidebar.tsx`
- Create: `frontend/src/admin/components/layout/AdminSidebar.test.tsx`

**Interfaces:**
- Consumes: `useHrPermissions` (`getCurrentUser`, Task 16), `HrModule`, `FULL_HR_PERMISSIONS` (Task 16).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/admin/components/layout/AdminSidebar.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

function setUser(user: Record<string, unknown>) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

describe('AdminSidebar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows every module by default (no stored permissions)', () => {
    render(<MemoryRouter><AdminSidebar isOpen onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('Leave Policies')).toBeInTheDocument();
  });

  it('hides a module the current HR admin cannot view', () => {
    setUser({
      isSuperAdmin: false,
      permissions: { employees: { canView: false, canManage: false } },
    });
    render(<MemoryRouter><AdminSidebar isOpen onClose={() => {}} /></MemoryRouter>);
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
  });

  it('hides the HR Permissions link for a non-Super-Admin', () => {
    setUser({ isSuperAdmin: false });
    render(<MemoryRouter><AdminSidebar isOpen onClose={() => {}} /></MemoryRouter>);
    expect(screen.queryByText('HR Permissions')).not.toBeInTheDocument();
  });

  it('shows the HR Permissions link for a Super Admin', () => {
    setUser({ isSuperAdmin: true });
    render(<MemoryRouter><AdminSidebar isOpen onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByText('HR Permissions')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run AdminSidebar.test.tsx`
Expected: FAIL (HR Permissions link doesn't exist yet, and no filtering happens)

- [ ] **Step 3: Tag nav items with their module and filter by permission**

In `frontend/src/admin/components/layout/AdminSidebar.tsx`, add the import:

```ts
import { Lock } from 'lucide-react';
import { getCurrentUser } from '../../utils/useHrPermissions';
import type { HrModule } from '../../types/hrPermissions';
import { FULL_HR_PERMISSIONS } from '../../types/hrPermissions';
```

Replace the `nav` constant with a version tagging each item with its `module` (Dashboard and Settings are left untagged):

```ts
const nav: { section: string; items: { label: string; path: string; icon: any; module?: HrModule }[] }[] = [
  { section: 'OVERVIEW',       items: [{ label: 'Dashboard',        path: '/admin/dashboard',   icon: LayoutDashboard }] },
  { section: 'WORKFORCE',      items: [
    { label: 'Employees',   path: '/admin/employees',   icon: Users, module: 'employees' },
    { label: 'Departments', path: '/admin/departments', icon: Building2, module: 'departments' },
  ] },
  { section: 'LEAVE MGMT',    items: [
    { label: 'Leave Requests',  path: '/admin/leaves',          icon: CalendarCheck, module: 'leaveRequests' },
    { label: 'Leave Balances',  path: '/admin/balances',        icon: Wallet, module: 'leaveBalances' },
    { label: 'Accrual History', path: '/admin/accrual-history', icon: History, module: 'accrualHistory' },
    { label: 'Leave Policies',  path: '/admin/policies',        icon: FileText, module: 'leavePolicies' },
  ] },
  { section: 'CONFIGURATION', items: [
    { label: 'Countries',            path: '/admin/countries',   icon: Globe, module: 'countries' },
    { label: 'Public Holidays',      path: '/admin/holidays',    icon: Palmtree, module: 'publicHolidays' },
    { label: 'Approval Levels',      path: '/admin/approval-levels', icon: Shield, module: 'approvalLevels' },
    { label: 'Notification Manager', path: '/admin/reminders',   icon: Mail, module: 'notificationManager' },
  ] },
  { section: 'ANALYTICS',     items: [
    { label: 'Reports',       path: '/admin/reports',       icon: BarChart3, module: 'reports' },
    { label: 'Audit Log',     path: '/admin/audit',         icon: ClipboardList, module: 'auditLog' },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell, module: 'notifications' },
  ] },
  { section: 'SYSTEM',        items: [{ label: 'Settings', path: '/admin/settings', icon: Settings }] },
];
```

Inside the component body, after the existing `currentUser` line, build the filtered nav:

```ts
  const permissions = currentUser.isSuperAdmin
    ? FULL_HR_PERMISSIONS
    : (currentUser.permissions || FULL_HR_PERMISSIONS);

  const visibleNav = nav
    .map(section => {
      if (section.section !== 'CONFIGURATION') return section;
      return {
        ...section,
        items: currentUser.isSuperAdmin
          ? [...section.items, { label: 'HR Permissions', path: '/admin/hr-permissions', icon: Lock }]
          : section.items,
      };
    })
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.module || permissions[item.module as HrModule]?.canView !== false),
    }))
    .filter(section => section.items.length > 0);
```

Replace `nav.map(...)` with `visibleNav.map(...)` in the JSX (the existing `{nav.map((section, idx) => (` line).

Note `currentUser` is currently read via `JSON.parse(localStorage.getItem('currentUser') || '{"name":"HR Admin",...}')` with a hardcoded fallback object — leave that line as-is (it already gives `isSuperAdmin: undefined` and `permissions: undefined` for the fallback, which the logic above treats as "not Super Admin, full access" — correct default).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run AdminSidebar.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/admin/components/layout/AdminSidebar.tsx frontend/src/admin/components/layout/AdminSidebar.test.tsx
git commit -m "feat: filter admin sidebar by HR permissions, add HR Permissions link"
```

---

### Task 18: Route guarding in `AdminApp.tsx`

**Files:**
- Create: `frontend/src/admin/components/ProtectedRoute.tsx`
- Modify: `frontend/src/admin/AdminApp.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 16), `HrModule` (Task 16).
- Produces: `<ProtectedRoute module="...">`, `<SuperAdminRoute>` — used by every route in `AdminApp.tsx` except Dashboard/Settings.

- [ ] **Step 1: Implement the route guard components**

```tsx
// frontend/src/admin/components/ProtectedRoute.tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/useHrPermissions';
import type { HrModule } from '../types/hrPermissions';

export function ProtectedRoute({ module, children }: { module: HrModule; children: ReactNode }) {
  const user = getCurrentUser();
  const allowed = !!user.isSuperAdmin || user.permissions?.[module]?.canView !== false;
  if (!allowed) return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const user = getCurrentUser();
  if (!user.isSuperAdmin) return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap every route in `AdminApp.tsx`**

```tsx
import { ProtectedRoute, SuperAdminRoute } from './components/ProtectedRoute';
import HRPermissions from './pages/HRPermissions';
```

```tsx
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/employees" element={<ProtectedRoute module="employees"><EmployeeList /></ProtectedRoute>} />
          <Route path="/leaves" element={<ProtectedRoute module="leaveRequests"><LeaveRequests /></ProtectedRoute>} />
          <Route path="/balances" element={<ProtectedRoute module="leaveBalances"><BalanceManagement /></ProtectedRoute>} />
          <Route path="/accrual-history" element={<ProtectedRoute module="accrualHistory"><AccrualHistory /></ProtectedRoute>} />
          <Route path="/policies" element={<ProtectedRoute module="leavePolicies"><LeavePolicies /></ProtectedRoute>} />
          <Route path="/approval-levels" element={<ProtectedRoute module="approvalLevels"><ApprovalLevels /></ProtectedRoute>} />
          <Route path="/countries" element={<ProtectedRoute module="countries"><Countries /></ProtectedRoute>} />
          <Route path="/holidays" element={<ProtectedRoute module="publicHolidays"><PublicHolidays /></ProtectedRoute>} />
          <Route path="/departments" element={<ProtectedRoute module="departments"><Departments /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute module="reports"><Reports /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute module="auditLog"><AuditLog /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute module="notifications"><Notifications /></ProtectedRoute>} />
          <Route path="/reminders" element={<ProtectedRoute module="notificationManager"><NotificationManager /></ProtectedRoute>} />
          <Route path="/hr-permissions" element={<SuperAdminRoute><HRPermissions /></SuperAdminRoute>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: fails only on the missing `./pages/HRPermissions` import — that's expected until Task 20. If you're executing tasks in order, skip straight to Task 19 and 20 before running this check; otherwise stub `frontend/src/admin/pages/HRPermissions.tsx` temporarily with `export default function HRPermissions() { return null; }` and replace it in Task 20.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/admin/components/ProtectedRoute.tsx frontend/src/admin/AdminApp.tsx
git commit -m "feat: guard admin routes by HR module view permission"
```

---

### Task 19: `HRPermissions.tsx` page

**Files:**
- Create: `frontend/src/admin/pages/HRPermissions.tsx`
- Create: `frontend/src/admin/pages/HRPermissions.test.tsx`

**Interfaces:**
- Consumes: `getHrAdmins`, `setHrPermissions` (Task 16's `hrPermissionsApi.ts`), `HR_MODULES`, `HR_MODULE_LABELS`, `HrPermissionMap` (Task 16's types), `SlideDrawer`, `SearchInput` (existing shared components).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/admin/pages/HRPermissions.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import HRPermissions from './HRPermissions';
import { getHrAdmins, setHrPermissions } from '../../services/hrPermissionsApi';
import { FULL_HR_PERMISSIONS } from '../types/hrPermissions';

vi.mock('../../services/hrPermissionsApi', () => ({
  getHrAdmins: vi.fn(),
  setHrPermissions: vi.fn(),
}));

const mockedGetHrAdmins = vi.mocked(getHrAdmins);
const mockedSetHrPermissions = vi.mocked(setHrPermissions);

describe('HRPermissions Admin Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetHrAdmins.mockResolvedValue([
      { id: 'a1', fullName: 'HR Admin User', email: 'admin@novelus.com', isSuperAdmin: true, permissions: FULL_HR_PERMISSIONS },
      { id: 'a2', fullName: 'hr salim 1', email: 'salim.hizi@esprit.tn', isSuperAdmin: false, permissions: FULL_HR_PERMISSIONS },
    ]);
    mockedSetHrPermissions.mockResolvedValue(FULL_HR_PERMISSIONS);
  });

  it('lists HR admins and marks the Super Admin', async () => {
    await act(async () => { render(<HRPermissions />); });
    expect(screen.getByText('HR Admin User')).toBeInTheDocument();
    expect(screen.getByText('hr salim 1')).toBeInTheDocument();
    expect(screen.getByText(/Super Admin/i)).toBeInTheDocument();
  });

  it('saves an updated permission set for a restricted user', async () => {
    await act(async () => { render(<HRPermissions />); });

    fireEvent.click(screen.getByText('hr salim 1'));
    const employeesViewCheckbox = await screen.findByLabelText('employees-view');
    fireEvent.click(employeesViewCheckbox);
    fireEvent.click(screen.getByText(/Save/i));

    await waitFor(() => {
      expect(mockedSetHrPermissions).toHaveBeenCalledWith(
        'a2',
        expect.arrayContaining([
          expect.objectContaining({ module: 'employees', canView: false }),
        ]),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run HRPermissions.test.tsx`
Expected: FAIL with "Cannot find module './HRPermissions'"

- [ ] **Step 3: Implement the page**

```tsx
// frontend/src/admin/pages/HRPermissions.tsx
import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import SearchInput from '../components/ui/SearchInput';
import SlideDrawer from '../components/ui/SlideDrawer';
import { getHrAdmins, setHrPermissions, type HrAdminListItem } from '../../services/hrPermissionsApi';
import { HR_MODULES, HR_MODULE_LABELS, type HrModule, type HrPermissionMap } from '../types/hrPermissions';
import { ApiError } from '../../services/apiClient';

export default function HRPermissions() {
  const [admins, setAdmins] = useState<HrAdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HrAdminListItem | null>(null);
  const [draft, setDraft] = useState<HrPermissionMap | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setApiError(null);
    try {
      const list = await getHrAdmins(signal);
      setAdmins(list || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setApiError(err instanceof ApiError ? err.message : 'Failed to load HR Admin users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  const filtered = admins.filter(a =>
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()),
  );

  function openManage(admin: HrAdminListItem) {
    setSelected(admin);
    setDraft({ ...admin.permissions });
  }

  function toggle(module: HrModule, field: 'canView' | 'canManage') {
    if (!draft) return;
    setDraft({
      ...draft,
      [module]: { ...draft[module], [field]: !draft[module][field] },
    });
  }

  async function handleSave() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const entries = HR_MODULES.map(module => ({
        module,
        canView: draft[module].canView,
        canManage: draft[module].canManage,
      }));
      const updated = await setHrPermissions(selected.id, entries);
      setAdmins(prev => prev.map(a => (a.id === selected.id ? { ...a, permissions: updated } : a)));
      setSelected(null);
      setDraft(null);
    } catch (err: unknown) {
      setApiError(err instanceof ApiError ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">HR Permissions</h1>
        <p className="text-slate-400 text-sm mt-1">Control what each HR Admin user can view or manage</p>
      </div>

      {apiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-xl p-3 flex items-center gap-2 text-red-600 dark:text-red-300 text-sm">
          <AlertCircle size={16} /> {apiError}
        </div>
      )}

      <div className="max-w-md"><SearchInput value={search} onChange={setSearch} placeholder="Search HR admin name or email..." /></div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50/50">
              <th className="py-3.5 px-4">HR Admin</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4 text-center">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {loading && (
              <tr><td colSpan={3} className="py-10 text-center text-slate-400"><Loader2 className="inline animate-spin" size={18} /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={3} className="py-16 text-center text-slate-400 text-sm">No HR Admin users found</td></tr>
            )}
            {filtered.map(admin => (
              <tr key={admin.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => !admin.isSuperAdmin && openManage(admin)}
                    className={`font-bold text-slate-800 dark:text-slate-200 ${admin.isSuperAdmin ? 'cursor-default' : 'hover:text-violet-600 cursor-pointer'}`}
                  >
                    {admin.fullName}
                  </button>
                  {admin.isSuperAdmin && (
                    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      <ShieldCheck size={10} /> Super Admin
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-slate-500 text-xs">{admin.email}</td>
                <td className="py-3.5 px-4 text-center">
                  {!admin.isSuperAdmin && (
                    <button onClick={() => openManage(admin)} className="text-violet-600 hover:text-violet-800 text-xs font-bold cursor-pointer">
                      Manage Access
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SlideDrawer
        isOpen={!!selected}
        onClose={() => { setSelected(null); setDraft(null); }}
        title="Manage Access"
        subtitle={selected ? `${selected.fullName} — ${selected.email}` : ''}
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  <th className="py-2">Module</th>
                  <th className="py-2 text-center">View</th>
                  <th className="py-2 text-center">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {HR_MODULES.map(module => (
                  <tr key={module}>
                    <td className="py-2 text-slate-700 dark:text-slate-200 font-medium">{HR_MODULE_LABELS[module]}</td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${module}-view`}
                        checked={draft[module].canView}
                        onChange={() => toggle(module, 'canView')}
                        className="accent-violet-600 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${module}-manage`}
                        checked={draft[module].canManage}
                        onChange={() => toggle(module, 'canManage')}
                        className="accent-violet-600 w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run HRPermissions.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Re-run the `AdminApp.tsx` build check from Task 18**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors now that `./pages/HRPermissions` exists

- [ ] **Step 6: Commit**

```bash
git add frontend/src/admin/pages/HRPermissions.tsx frontend/src/admin/pages/HRPermissions.test.tsx
git commit -m "feat: add HR Permissions admin page"
```

---

### Task 20: Gate `EmployeeList.tsx` actions by `canManage`

**Files:**
- Modify: `frontend/src/admin/pages/EmployeeList.tsx`
- Modify: `frontend/src/admin/pages/EmployeeList.test.tsx` (extend if it exists; check first)

**Interfaces:**
- Consumes: `useHrPermission('employees')` (Task 16).

- [ ] **Step 1: Check for an existing test file**

Run: `ls frontend/src/admin/pages/EmployeeList.test.tsx 2>/dev/null || echo "none"`

- [ ] **Step 2: Import the hook and read `canManage`**

In `frontend/src/admin/pages/EmployeeList.tsx`, add the import:

```ts
import { useHrPermission } from '../utils/useHrPermissions';
```

Inside the component function body (near the other `useState` declarations, e.g. right after `const [deleteId, setDeleteId] = useState...`):

```ts
  const { canManage } = useHrPermission('employees');
```

- [ ] **Step 3: Gate the "Add Employee" button**

Replace:

```tsx
        <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer">
          <Plus size={16} /> Add Employee
        </button>
```

with:

```tsx
        {canManage && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-colors cursor-pointer">
            <Plus size={16} /> Add Employee
          </button>
        )}
```

- [ ] **Step 4: Gate the per-row Edit / Toggle-Status / Delete buttons (leave History and View untouched — those are read actions)**

Replace:

```tsx
                        <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer" title="Edit"><Edit2 size={14}/></button>
                        <button onClick={() => toggleStatus(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer" title="Toggle Status">
                          {emp.status === 'active' ? <Archive size={14}/> : <UserCheck size={14}/>}
                        </button>
                        <button onClick={() => setDeleteId(emp.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete"><Trash2 size={14}/></button>
```

with:

```tsx
                        {canManage && (
                          <>
                            <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer" title="Edit"><Edit2 size={14}/></button>
                            <button onClick={() => toggleStatus(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer" title="Toggle Status">
                              {emp.status === 'active' ? <Archive size={14}/> : <UserCheck size={14}/>}
                            </button>
                            <button onClick={() => setDeleteId(emp.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete"><Trash2 size={14}/></button>
                          </>
                        )}
```

- [ ] **Step 5: Write or extend the test**

If no test file exists, create a minimal one:

```tsx
// frontend/src/admin/pages/EmployeeList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EmployeeList from './EmployeeList';
import { getEmployees } from '../../services/employeesApi';

vi.mock('../../services/employeesApi', () => ({
  getEmployees: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
}));

const mockedGetEmployees = vi.mocked(getEmployees);

describe('EmployeeList action gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedGetEmployees.mockResolvedValue([
      { id: 'e1', fullName: 'Test Employee', email: 't@novelus.com', role: 'EMPLOYEE', department: 'Engineering', status: 'ACTIVE', hireDate: '2024-01-01' } as any,
    ]);
  });

  it('hides Add Employee when canManage is false', async () => {
    localStorage.setItem('currentUser', JSON.stringify({
      isSuperAdmin: false,
      permissions: { employees: { canView: true, canManage: false } },
    }));
    await act(async () => { render(<MemoryRouter><EmployeeList /></MemoryRouter>); });
    expect(screen.queryByText('Add Employee')).not.toBeInTheDocument();
  });

  it('shows Add Employee when canManage is true', async () => {
    localStorage.setItem('currentUser', JSON.stringify({
      isSuperAdmin: false,
      permissions: { employees: { canView: true, canManage: true } },
    }));
    await act(async () => { render(<MemoryRouter><EmployeeList /></MemoryRouter>); });
    expect(screen.getByText('Add Employee')).toBeInTheDocument();
  });
});
```

If a test file already exists for `EmployeeList.tsx`, add these two `it(...)` blocks to it instead, matching whatever mock setup it already uses for `employeesApi` (check the file's existing mocks before assuming the shape above).

- [ ] **Step 6: Run the test**

Run: `cd frontend && npx vitest run EmployeeList.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/admin/pages/EmployeeList.tsx frontend/src/admin/pages/EmployeeList.test.tsx
git commit -m "feat: gate employee management actions by canManage permission"
```

---

### Task 21: Gate actions on the remaining admin pages

**Files:**
- Modify: `frontend/src/admin/pages/Departments.tsx`
- Modify: `frontend/src/admin/pages/LeaveRequests.tsx`
- Modify: `frontend/src/admin/pages/BalanceManagement.tsx`
- Modify: `frontend/src/admin/pages/PublicHolidays.tsx`
- Modify: `frontend/src/admin/pages/ApprovalLevels.tsx`
- Modify: `frontend/src/admin/pages/LeavePolicies.tsx`
- Modify: `frontend/src/admin/pages/Countries.tsx`
- Modify: `frontend/src/admin/pages/NotificationManager.tsx`

**Interfaces:**
- Consumes: `useHrPermission(module)` (Task 16), applied identically to Task 20's pattern.

This task repeats the exact mechanical pattern from Task 20 across eight files: import the hook, read `canManage` for that page's module, wrap the primary "Add X" trigger button and the per-row Edit/Delete (or equivalent manage-only) buttons in `{canManage && (...)}`. No new tests are added in this task — Task 20 already proves the hook-gating pattern works; repeating a full RTL test per page for an identical mechanical change is not worth the duplication (YAGNI). If a page's behavior diverges from the pattern below in a way that changes what "manage" means for it, note that when implementing and adjust accordingly rather than forcing the literal diff.

- [ ] **Step 1: `Departments.tsx` (module `departments`)**

Add `import { useHrPermission } from '../utils/useHrPermissions';` and `const { canManage } = useHrPermission('departments');`.

Wrap the button at line 143 (`<Plus size={18} /> Add Department`) in `{canManage && (...)}`.

Wrap the `Edit2` button (line ~197) and `Trash2` button (line ~204) together in `{canManage && (<>...</>)}`, same as Task 20 Step 4.

- [ ] **Step 2: `LeaveRequests.tsx` (module `leaveRequests`)**

Add the hook import and `const { canManage } = useHrPermission('leaveRequests');`.

Wrap the Approve/Reject buttons inside the `req.canApprove` branch (lines ~253–256) in `{canManage && ( ... )}`, and the Delete button (line ~264) in `{canManage && (...)}`. Also wrap the two detail-drawer action buttons (Approve/Reject at ~321–324, Delete at ~328) the same way.

- [ ] **Step 3: `BalanceManagement.tsx` (module `leaveBalances`)**

Add the hook import and `const { canManage } = useHrPermission('leaveBalances');`.

Wrap the "Adjust Balance" trigger button (around line 351–357, the one that calls `setAdjustModal(...)`) in `{canManage && (...)}`.

- [ ] **Step 4: `PublicHolidays.tsx` (module `publicHolidays`)**

Add the hook import and `const { canManage } = useHrPermission('publicHolidays');`.

Wrap the "Add Holiday" button (line 204) and the `Edit2`/`Trash2` buttons (lines ~358, ~365) the same way as Task 20.

- [ ] **Step 5: `ApprovalLevels.tsx` (module `approvalLevels`)**

Add the hook import and `const { canManage } = useHrPermission('approvalLevels');`.

Wrap the "Add Configuration" button (lines 252–253) and the `Edit2`/`Trash2` buttons (lines ~339, ~346).

- [ ] **Step 6: `LeavePolicies.tsx` (module `leavePolicies`)**

Add the hook import and `const { canManage } = useHrPermission('leavePolicies');`.

Wrap the "Add Policy" button (line 474), the `Edit2`/`Trash2` buttons (lines ~556, ~566), and the "Edit Policy" button inside the view-only detail panel (line ~1394).

- [ ] **Step 7: `Countries.tsx` (module `countries`)**

Add the hook import and `const { canManage } = useHrPermission('countries');`.

Wrap the "Add Country" button (line 204) and the `Edit2`/`Trash2` buttons (lines ~275, ~282). Leave the other `Trash2` usages further down (lines ~460, ~509) as-is only if they belong to a different, unrelated delete flow — check their surrounding context when implementing; if they delete country-related sub-records (e.g. holidays tied to a country from within this page), gate them too under the same `canManage`.

- [ ] **Step 8: `NotificationManager.tsx` (module `notificationManager`)**

Add the hook import and `const { canManage } = useHrPermission('notificationManager');`.

Wrap the "Save Settings" button (lines 225–230) in `{canManage && (...)}`. If a "Run Now" trigger button exists elsewhere in the file (check for it — the backend route `POST /reminders/run` was gated as `manage` in Task 15), wrap that too. Reading history/settings (view) stays ungated.

- [ ] **Step 9: Verify the frontend build**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 10: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: all existing tests still PASS (no regressions from the new hook imports)

- [ ] **Step 11: Commit**

```bash
git add frontend/src/admin/pages/Departments.tsx frontend/src/admin/pages/LeaveRequests.tsx frontend/src/admin/pages/BalanceManagement.tsx frontend/src/admin/pages/PublicHolidays.tsx frontend/src/admin/pages/ApprovalLevels.tsx frontend/src/admin/pages/LeavePolicies.tsx frontend/src/admin/pages/Countries.tsx frontend/src/admin/pages/NotificationManager.tsx
git commit -m "feat: gate remaining admin page actions by canManage permission"
```

---

### Task 22: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all tests PASS, including every new spec added in Tasks 1–15

- [ ] **Step 2: Run the full backend type check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: all tests PASS, including every new test added in Tasks 16–20

- [ ] **Step 4: Run the full frontend build**

Run: `cd frontend && npm run build`
Expected: builds successfully with no type errors

- [ ] **Step 5: Manual smoke test (documented, not automated)**

Start both servers (`cd backend && npm run start:dev`, `cd frontend && npm run dev`), log in as `admin@novelus.com` (Super Admin) — confirm "HR Permissions" appears under Configuration and every other module is visible. Create a second HR_ADMIN user (or use the existing "hr salim 1" from earlier in this session), open HR Permissions, uncheck "View" for Employees and save, then `dev-login` as that user and confirm the Employees link disappears from their sidebar and `GET /employees` returns 403 for them directly (e.g. via the Swagger UI at `/api` with that user's id in `x-employee-id`) while it still works for a manager/employee account and for the Super Admin.

- [ ] **Step 6: No commit for this task** — it's verification only, nothing to stage.
