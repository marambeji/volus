# Half-Day Leave Requests (Day Portion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status: ✅ All 6 tasks complete, plus a Task 7 fix found in real usage after rollout.** Executed inline in the same session (not via subagent dispatch — the human partner asked for direct implementation partway through Task 1) rather than through subagent-driven-development. Backend 154/154 tests passing, frontend 39/39 passing (stable across repeated full-suite runs), `tsc --noEmit` clean on every touched file. See "Deviations from this plan" at the end of each task, and Task 7, for what changed versus the text below. Commits (in order): `ade9413`, `ddf2b8a`, `c844213`, `92291f4`, `69d49b2`, `17ed88f`, `8f0564d`, `573fa5d`.

**Goal:** Let an employee request a half-day of an *existing* leave type (e.g. Annual Leave) — no new "Half Day" leave type — by tagging the request `FULL_DAY`, `FIRST_HALF`, or `SECOND_HALF`, and correctly deduct 0.5 days from their balance for a half-day request.

**Architecture:** The system already stores `durationDays` as a decimal (`numeric(6,2)`) and already has a per-leave-rule `allowsHalfDay` toggle that gates a `0.5 (Half Day)` option in the request form's per-date amount dropdown — balance deduction (`applyLedger`) already works generically off `request.durationDays`, so 0.5-day deduction needs no change. The one real gap is that nothing records **which half** of the day was taken. This plan adds a `dayPortion` enum column to `leave_requests` (default `FULL_DAY`), validates it server-side (a non-`FULL_DAY` portion requires a single-day request with `durationDays === 0.5` and a leave rule that allows half days), threads it through the existing read endpoints, and adds a small "First Half / Second Half" picker to the request form plus a badge on the request-list surfaces.

**Tech Stack:** NestJS + TypeORM + PostgreSQL (backend), React + Vite + Tailwind (frontend), Jest (backend tests), Vitest + React Testing Library (frontend tests).

**Spec:** This plan's spec is the user's request, restated: "Use the existing leave type (e.g. Annual Leave) and allow the duration to be 0.5 day instead of creating a new 'Half Day' leave type. Add: FULL_DAY, FIRST_HALF, SECOND_HALF. A half day should deduct 0.5 from the leave balance. Check the current backend and frontend implementation and update all necessary logic, validation, database fields, UI, and tests."

## Global Constraints

- No new leave type is created — `dayPortion` is a field on `leave_requests`, not on `leave_types`.
- `dayPortion` is only ever `FIRST_HALF` or `SECOND_HALF` for a **single-day** request (`startDate === endDate`) with `durationDays === 0.5`. Multi-day requests (including ones that mix full/half/excluded days via the existing per-date "Duration Adjustments" table) always persist `FULL_DAY` — this plan does not add per-day portion tracking across a date range, only a single-day AM/PM tag. This is a scope decision, not something the user specified either way — flag it if it's wrong.
- Half-day requests still require `leaveRule.allowsHalfDay === true` for the employee's leave type, exactly like the existing 0.5-day dropdown option already requires client-side.
- Balance deduction logic (`applyLedger`) is untouched — it already deducts `request.durationDays` verbatim, so 0.5 already works.
- Existing conflict/overlap detection (client-side only, in `RequestModal.tsx`) is untouched — this plan does not add "AM + PM on the same day from two different requests" support. Out of scope.

---

## File Structure

**Backend:**
- `backend/src/common/enums/index.ts` — add `DayPortion` enum.
- `backend/src/database/migrations/1787700000000-AddDayPortionToLeaveRequests.ts` — new migration adding the `day_portion` column.
- `backend/src/database/data-source.ts` — register the new migration.
- `backend/src/modules/leave-requests/entities/leave-request.entity.ts` — add `dayPortion` column.
- `backend/src/modules/leave-requests/leave-requests.controller.ts` — accept `dayPortion` in the create DTO.
- `backend/src/modules/leave-requests/leave-requests.service.ts` — validate + persist `dayPortion`; expose it from `getMyApprovals`, `findMyRequests`, `hrFindAll`, `getWhosOut`.
- `backend/src/modules/leave-requests/leave-requests.service.spec.ts` — unit tests for the new validation + `findMyRequests` passthrough.

**Frontend:**
- `frontend/src/services/employeesApi.ts` — `submitLeaveRequest` payload gains `dayPortion?: string`.
- `frontend/src/components/dashboard/RequestModal.tsx` — half-day AM/PM picker + submission wiring.
- `frontend/src/components/dashboard/RequestModal.test.tsx` — new test file.
- `frontend/src/pages/LeaveTracking.tsx` — show an AM/PM badge on the employee's own request list/drawer.
- `frontend/src/pages/LeaveTracking.test.tsx` — extend with a half-day case.
- `frontend/src/pages/ApprovalDashboard.tsx` — show the badge on the manager's approval cards/modal.
- `frontend/src/pages/ApprovalDashboard.test.tsx` — extend with a half-day case.
- `frontend/src/admin/pages/LeaveRequests.tsx` — show the badge in the HR review table/drawer.
- `frontend/src/admin/pages/LeaveRequests.test.tsx` — new test file.

---

### Task 1: Backend — `DayPortion` enum, entity column, migration

**Files:**
- Modify: `backend/src/common/enums/index.ts`
- Create: `backend/src/database/migrations/1787700000000-AddDayPortionToLeaveRequests.ts`
- Modify: `backend/src/database/data-source.ts`
- Modify: `backend/src/modules/leave-requests/entities/leave-request.entity.ts`
- Test: `backend/src/common/enums/day-portion.spec.ts`

**Interfaces:**
- Produces: `DayPortion` enum (`FULL_DAY`, `FIRST_HALF`, `SECOND_HALF`) importable from `../../common/enums` (relative to `backend/src/modules/**`); `LeaveRequest.dayPortion: DayPortion` column, non-null, default `FULL_DAY`.

- [x] **Step 1: Write the failing test**

Create `backend/src/common/enums/day-portion.spec.ts`:

```typescript
import { DayPortion } from './index';

describe('DayPortion enum', () => {
  it('has exactly FULL_DAY, FIRST_HALF, SECOND_HALF', () => {
    expect(Object.values(DayPortion).sort()).toEqual(
      ['FIRST_HALF', 'FULL_DAY', 'SECOND_HALF'].sort(),
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest common/enums/day-portion.spec.ts`
Expected: FAIL — `DayPortion` is not exported from `./index` (TS compile error).

- [x] **Step 3: Add the enum**

In `backend/src/common/enums/index.ts`, add (near `LeaveRequestStatus`):

```typescript
export enum DayPortion {
  FULL_DAY = 'FULL_DAY',
  FIRST_HALF = 'FIRST_HALF',
  SECOND_HALF = 'SECOND_HALF',
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest common/enums/day-portion.spec.ts`
Expected: PASS

- [x] **Step 5: Add the entity column**

In `backend/src/modules/leave-requests/entities/leave-request.entity.ts`, change the import and add the column right after `durationDays`:

```typescript
import { LeaveRequestStatus, DayPortion } from '../../../common/enums';
```

```typescript
  @Column({
    name: 'day_portion',
    type: 'enum',
    enum: DayPortion,
    default: DayPortion.FULL_DAY,
  })
  dayPortion: DayPortion;
```

- [x] **Step 6: Write the migration**

Create `backend/src/database/migrations/1787700000000-AddDayPortionToLeaveRequests.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDayPortionToLeaveRequests1787700000000
  implements MigrationInterface
{
  name = 'AddDayPortionToLeaveRequests1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."leave_requests_day_portion_enum" AS ENUM('FULL_DAY', 'FIRST_HALF', 'SECOND_HALF')
    `);
    await queryRunner.query(`
      ALTER TABLE "leave_requests" ADD "day_portion" "public"."leave_requests_day_portion_enum" NOT NULL DEFAULT 'FULL_DAY'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leave_requests" DROP COLUMN "day_portion"`);
    await queryRunner.query(`DROP TYPE "public"."leave_requests_day_portion_enum"`);
  }
}
```

- [x] **Step 7: Register the migration**

In `backend/src/database/data-source.ts`, add the import after the `AddHrPermissions1787600000000` import:

```typescript
import { AddDayPortionToLeaveRequests1787700000000 } from './migrations/1787700000000-AddDayPortionToLeaveRequests';
```

And add it as the last entry of the `migrations: [...]` array:

```typescript
    AddHrPermissions1787600000000,
    AddDayPortionToLeaveRequests1787700000000,
  ],
```

- [x] **Step 8: Verify the project still compiles**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors from the touched files.

- [x] **Step 9: Commit**

```bash
git add backend/src/common/enums/index.ts backend/src/common/enums/day-portion.spec.ts backend/src/database/migrations/1787700000000-AddDayPortionToLeaveRequests.ts backend/src/database/data-source.ts backend/src/modules/leave-requests/entities/leave-request.entity.ts
git commit -m "feat: add DayPortion enum and leave_requests.day_portion column"
```

**Deviations from this plan:** none — implemented exactly as written (commit `ade9413`). One operational gotcha discovered later: this task only adds the migration *file*; it still has to be run against the actual database (`cd backend && npm run migration:run`) before the column exists. `synchronize: false` means TypeORM never creates it automatically. The first live submission attempt after Task 6 shipped failed with `column LeaveRequest.day_portion does not exist` until the migration was run — see Task 7.

---

### Task 2: Backend — validate and persist `dayPortion` on submission

**Files:**
- Modify: `backend/src/modules/leave-requests/leave-requests.controller.ts`
- Modify: `backend/src/modules/leave-requests/leave-requests.service.ts`
- Test: `backend/src/modules/leave-requests/leave-requests.service.spec.ts`

**Interfaces:**
- Consumes: `DayPortion` enum, `LeaveRequest.dayPortion` (Task 1).
- Produces: `LeaveRequestsService.validateDayPortion(dto, leaveRule): DayPortion` — a private method, callable in tests via `(service as any).validateDayPortion(...)`. `create()`'s DTO type gains `dayPortion?: DayPortion` and its created `LeaveRequest` now persists `dayPortion`.

- [x] **Step 1: Write the failing tests**

Add these two imports to the top of `backend/src/modules/leave-requests/leave-requests.service.spec.ts`, alongside the existing imports:

```typescript
import { DayPortion } from '../../common/enums';
import { LeaveRule } from '../policies/entities/leave-rule.entity';
```

Then append this new `describe` block to the end of the file (keep the existing `describe('LeaveRequestsService - Sequential Approval...')` block untouched):

```typescript
describe('LeaveRequestsService - validateDayPortion', () => {
  let service: LeaveRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: {} },
        { provide: getRepositoryToken(ApprovalInstance), useValue: {} },
        { provide: LeaveBalancesService, useValue: {} },
        { provide: ApprovalWorkflowsService, useValue: {} },
        { provide: AuditLogsService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  const baseDto = {
    startDate: '2026-09-10',
    endDate: '2026-09-10',
    durationDays: 0.5,
  };
  const allowingRule = { allowsHalfDay: true } as LeaveRule;
  const forbiddingRule = { allowsHalfDay: false } as LeaveRule;

  it('defaults to FULL_DAY when dayPortion is omitted, regardless of the rule', () => {
    const result = (service as any).validateDayPortion(
      { startDate: '2026-09-10', endDate: '2026-09-12', durationDays: 3 },
      forbiddingRule,
    );
    expect(result).toBe(DayPortion.FULL_DAY);
  });

  it('accepts FIRST_HALF for a single 0.5-day request when the rule allows half days', () => {
    const result = (service as any).validateDayPortion(
      { ...baseDto, dayPortion: DayPortion.FIRST_HALF },
      allowingRule,
    );
    expect(result).toBe(DayPortion.FIRST_HALF);
  });

  it('accepts SECOND_HALF for a single 0.5-day request when the rule allows half days', () => {
    const result = (service as any).validateDayPortion(
      { ...baseDto, dayPortion: DayPortion.SECOND_HALF },
      allowingRule,
    );
    expect(result).toBe(DayPortion.SECOND_HALF);
  });

  it('rejects a half-day portion spanning more than one day', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { startDate: '2026-09-10', endDate: '2026-09-11', durationDays: 0.5, dayPortion: DayPortion.FIRST_HALF },
        allowingRule,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a half-day portion when durationDays is not 0.5', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { ...baseDto, durationDays: 1, dayPortion: DayPortion.FIRST_HALF },
        allowingRule,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a half-day portion when the leave rule does not allow half days', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { ...baseDto, dayPortion: DayPortion.SECOND_HALF },
        forbiddingRule,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a half-day portion when no leave rule was resolved', () => {
    expect(() =>
      (service as any).validateDayPortion(
        { ...baseDto, dayPortion: DayPortion.FIRST_HALF },
        null,
      ),
    ).toThrow(BadRequestException);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest leave-requests.service.spec.ts -t "validateDayPortion"`
Expected: FAIL — `validateDayPortion` does not exist on `LeaveRequestsService`.

- [x] **Step 3: Implement `validateDayPortion` and wire it into `create()`**

In `backend/src/modules/leave-requests/leave-requests.service.ts`, update imports:

```typescript
import {
  LeaveRequestStatus,
  LedgerTransactionType,
  ApproverType,
  ApprovalInstanceStatus,
  AuditActionType,
  EmployeeRole,
  EmployeeStatus,
  CalendarScope,
  DayPortion,
} from '../../common/enums';
import { LeaveRule } from '../policies/entities/leave-rule.entity';
```

Add the private method (place it right above `async create(`):

```typescript
  private validateDayPortion(
    dto: { startDate: string; endDate: string; durationDays: number; dayPortion?: DayPortion },
    leaveRule: LeaveRule | null,
  ): DayPortion {
    const dayPortion = dto.dayPortion ?? DayPortion.FULL_DAY;
    if (dayPortion === DayPortion.FULL_DAY) return dayPortion;

    if (dto.startDate !== dto.endDate) {
      throw new BadRequestException(
        'A half-day request (FIRST_HALF or SECOND_HALF) must have the same start and end date.',
      );
    }
    if (Number(dto.durationDays) !== 0.5) {
      throw new BadRequestException(
        'A half-day request (FIRST_HALF or SECOND_HALF) must have a duration of exactly 0.5 days.',
      );
    }
    if (!leaveRule?.allowsHalfDay) {
      throw new BadRequestException(
        'Half-day requests are not allowed for this leave type.',
      );
    }
    return dayPortion;
  }
```

Update `create()`'s DTO type (both the method signature here and the controller's, in the next step):

```typescript
  async create(
    employeeId: string,
    dto: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; dayPortion?: DayPortion; reason?: string },
  ) {
```

Right after the existing `leaveRule` raw lookup (used for `approvalWorkflowId`) and before step 3 (`Resolve approvers...`), fetch the typed `LeaveRule` entity so `allowsHalfDay` is available with a real boolean, then validate:

```typescript
      // 2b. Load the typed leave rule (for allowsHalfDay) and validate the requested day portion
      const leaveRuleEntity = await em.findOne(LeaveRule, {
        where: {
          policyId: policyAssignment.epa_leave_policy_id,
          leaveTypeId: dto.leaveTypeId,
        },
      });
      const dayPortion = this.validateDayPortion(dto, leaveRuleEntity);
```

Finally, persist it in the `em.create(LeaveRequest, {...})` call:

```typescript
      const request = em.create(LeaveRequest, {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        durationDays: dto.durationDays,
        dayPortion,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING,
        workflowSnapshot: snapshot,
      });
```

- [x] **Step 4: Update the controller's DTO type**

In `backend/src/modules/leave-requests/leave-requests.controller.ts`, add the import:

```typescript
import { DayPortion } from '../../common/enums';
```

And update the `create` method's `@Body()` type:

```typescript
  create(
    @Headers('x-employee-id') employeeId: string,
    @Body() dto: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; dayPortion?: DayPortion; reason?: string },
  ) {
```

- [x] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest leave-requests.service.spec.ts`
Expected: PASS (all tests in the file, including the pre-existing approval-workflow suite — this task must not break it).

- [x] **Step 6: Verify the project still compiles**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [x] **Step 7: Commit**

```bash
git add backend/src/modules/leave-requests/leave-requests.controller.ts backend/src/modules/leave-requests/leave-requests.service.ts backend/src/modules/leave-requests/leave-requests.service.spec.ts
git commit -m "feat: validate and persist half-day dayPortion on leave request submission"
```

**Deviations from this plan:** none — implemented exactly as written (commit `ddf2b8a`), including the `LeaveRule` entity import and the `validateDayPortion` signature.

---

### Task 3: Backend — expose `dayPortion` in the read endpoints

**Files:**
- Modify: `backend/src/modules/leave-requests/leave-requests.service.ts`
- Test: `backend/src/modules/leave-requests/leave-requests.service.spec.ts`

**Interfaces:**
- Consumes: `LeaveRequest.dayPortion` (Task 1).
- Produces: `dayPortion` field on the objects returned by `getMyApprovals()`, `findMyRequests()`, `hrFindAll()` (replacing the unused `halfDayInformation: null` stub), and `getWhosOut()`.

- [x] **Step 1: Write the failing test**

Append this as a new top-level `describe` block at the end of `backend/src/modules/leave-requests/leave-requests.service.spec.ts` (after the `describe('LeaveRequestsService - validateDayPortion', ...)` block added in Task 2), reusing the same `{ find: jest.Mock }` `requestRepo` shape declared in the file's first `describe` block:

```typescript
describe('LeaveRequestsService - findMyRequests exposes dayPortion', () => {
  let service: LeaveRequestsService;
  let requestRepo: { find: jest.Mock };

  beforeEach(async () => {
    requestRepo = { find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        { provide: getRepositoryToken(LeaveRequest), useValue: requestRepo },
        { provide: getRepositoryToken(ApprovalInstance), useValue: {} },
        { provide: LeaveBalancesService, useValue: {} },
        { provide: ApprovalWorkflowsService, useValue: {} },
        { provide: AuditLogsService, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();
    service = module.get<LeaveRequestsService>(LeaveRequestsService);
  });

  it('includes dayPortion on each mapped request', async () => {
    requestRepo.find.mockResolvedValue([
      {
        id: 'req-1',
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        leaveType: { label: 'Annual Leave' },
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        durationDays: 0.5,
        dayPortion: DayPortion.FIRST_HALF,
        reason: '',
        status: 'PENDING',
        rejectionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalInstances: [],
      },
    ]);

    const result = await service.findMyRequests('emp-1');

    expect(result[0].dayPortion).toBe(DayPortion.FIRST_HALF);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest leave-requests.service.spec.ts -t "exposes dayPortion"`
Expected: FAIL — `result[0].dayPortion` is `undefined`.

- [x] **Step 3: Add `dayPortion` to the four mappers**

In `backend/src/modules/leave-requests/leave-requests.service.ts`:

In `getMyApprovals()`'s returned object (the one with `durationDays: inst.request?.durationDays,`), add right after it:

```typescript
      durationDays: inst.request?.durationDays,
      dayPortion: inst.request?.dayPortion,
```

In `findMyRequests()`'s returned object (the one with `durationDays: lr.durationDays,`), add right after it:

```typescript
        durationDays: lr.durationDays,
        dayPortion: lr.dayPortion,
```

In `hrFindAll()`'s returned object, replace the stub line:

```typescript
        requestedDuration: lr.durationDays,
        halfDayInformation: null,
```

with:

```typescript
        requestedDuration: lr.durationDays,
        dayPortion: lr.dayPortion,
```

In `getWhosOut()`'s returned object (the one with `requestedDuration: lr.durationDays,`), add right after it:

```typescript
      requestedDuration: lr.durationDays,
      dayPortion: lr.dayPortion,
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest leave-requests.service.spec.ts`
Expected: PASS (whole file).

- [x] **Step 5: Commit**

```bash
git add backend/src/modules/leave-requests/leave-requests.service.ts backend/src/modules/leave-requests/leave-requests.service.spec.ts
git commit -m "feat: expose dayPortion on leave-requests read endpoints"
```

**Deviations from this plan:** none — implemented exactly as written (commit `c844213`), including replacing the dead `halfDayInformation: null` stub in `hrFindAll()` with the real field.

---

### Task 4: Frontend — half-day AM/PM picker in the request form

**Files:**
- Modify: `frontend/src/services/employeesApi.ts:124-131`
- Modify: `frontend/src/components/dashboard/RequestModal.tsx`
- Create: `frontend/src/components/dashboard/RequestModal.test.tsx`

**Interfaces:**
- Consumes: `POST /leave-requests` now accepting `dayPortion` (Task 2).
- Produces: `submitLeaveRequest(payload)` accepts an optional `dayPortion: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'` field.

- [x] **Step 1: Update `submitLeaveRequest`'s payload type**

In `frontend/src/services/employeesApi.ts`:

```typescript
export async function submitLeaveRequest(
  payload: { leaveTypeId: string; startDate: string; endDate: string; durationDays: number; dayPortion?: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'; reason?: string }
): Promise<any> {
```

- [x] **Step 2: Write the failing test**

Create `frontend/src/components/dashboard/RequestModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestModal from './RequestModal';
import { getMyLeaveBalances, submitLeaveRequest, getMyLeaveRequests, getEmployees } from '../../services/employeesApi';
import { getLeaveTypes } from '../../services/leaveTypesApi';
import { getHolidays } from '../../services/holidaysApi';

vi.mock('../../services/employeesApi', () => ({
  getMyLeaveBalances: vi.fn(),
  submitLeaveRequest: vi.fn(),
  getMyLeaveRequests: vi.fn(),
  getEmployees: vi.fn(),
}));
vi.mock('../../services/leaveTypesApi', () => ({
  getLeaveTypes: vi.fn(),
}));
vi.mock('../../services/holidaysApi', () => ({
  getHolidays: vi.fn(),
}));

const mockedGetMyLeaveBalances = vi.mocked(getMyLeaveBalances);
const mockedSubmitLeaveRequest = vi.mocked(submitLeaveRequest);
const mockedGetMyLeaveRequests = vi.mocked(getMyLeaveRequests);
const mockedGetEmployees = vi.mocked(getEmployees);
const mockedGetLeaveTypes = vi.mocked(getLeaveTypes);
const mockedGetHolidays = vi.mocked(getHolidays);

describe('RequestModal half-day portion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('currentUser', JSON.stringify({ id: 'emp-1' }));

    mockedGetMyLeaveBalances.mockResolvedValue({
      countryId: 'c-1',
      balances: [
        {
          leaveTypeId: 'lt-annual',
          code: 'ANNUAL',
          name: 'Annual Leave',
          availableBalance: 20,
          usageYtd: 0,
          trackingMode: 'AVAILABLE_BALANCE',
          allowsHalfDay: true,
          requiresNote: false,
          requiresPositiveBalance: true,
          eligible: true,
        },
      ],
    });
    mockedGetLeaveTypes.mockResolvedValue([{ id: 'lt-annual', key: 'annual', label: 'Annual Leave', trackingMode: 'AVAILABLE_BALANCE' } as any]);
    mockedGetMyLeaveRequests.mockResolvedValue([]);
    mockedGetHolidays.mockResolvedValue([]);
    mockedGetEmployees.mockResolvedValue([{ id: 'emp-1', countryId: 'c-1', countryCode: 'LB', country: 'Lebanon', gender: 'MALE' } as any]);
    mockedSubmitLeaveRequest.mockResolvedValue({});
  });

  it('shows First/Second Half options only once a single day is set to 0.5, and submits the chosen portion', async () => {
    const user = userEvent.setup();
    const { container } = render(<RequestModal isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(container.querySelectorAll('input[type="date"]').length).toBe(2);
    });

    // Native date inputs: set via fireEvent.change (userEvent.type does not
    // reliably drive type="date" inputs in jsdom), then wait for the
    // dailyAmounts effect (keyed on [startDate, endDate]) to settle.
    const [fromDate, toDate] = Array.from(container.querySelectorAll('input[type="date"]'));
    fireEvent.change(fromDate, { target: { value: '2026-09-10' } });
    fireEvent.change(toDate, { target: { value: '2026-09-10' } });

    // Half Day option should not surface a portion picker until 0.5 is chosen
    expect(screen.queryByText(/Second Half/i)).not.toBeInTheDocument();

    const amountSelect = await screen.findByDisplayValue('1 (Full Day)');
    await user.selectOptions(amountSelect, '0.5');

    const secondHalfBtn = await screen.findByRole('button', { name: /Second Half/i });
    await user.click(secondHalfBtn);

    await user.type(screen.getByPlaceholderText(/Add any comments/i), 'Doctor appointment');

    const submitBtn = screen.getByRole('button', { name: /Submit Request/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockedSubmitLeaveRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          leaveTypeId: 'lt-annual',
          startDate: '2026-09-10',
          endDate: '2026-09-10',
          durationDays: 0.5,
          dayPortion: 'SECOND_HALF',
        }),
      );
    });
  });
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/dashboard/RequestModal.test.tsx`
Expected: FAIL — no "Second Half" button exists yet, and the submitted payload has no `dayPortion`.

- [x] **Step 4: Implement the picker in `RequestModal.tsx`**

Add state (next to the other `useState` declarations, after `dailyAmounts`):

```typescript
  const [dayPortion, setDayPortion] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY');
```

Reset it in the modal-close branch of the `isOpen` effect (alongside the other resets):

```typescript
    } else {
      setStartDate('');
      setEndDate('');
      setReason('');
      setSubmitted(false);
      setCalDate(new Date());
      setConfig(null);
      setSelectedHolidayIds([]);
      setHolidays([]);
      setDayPortion('FULL_DAY');
    }
```

Right after the existing `dailyAmounts` computation, derive whether the portion picker applies, and auto-reset `dayPortion` when it stops applying:

```typescript
  const isSingleDay = !!startDate && !!endDate && startDate === endDate;
  const isHalfDaySelected = isSingleDay && dailyAmounts[startDate] === 0.5;

  useEffect(() => {
    if (!isHalfDaySelected && dayPortion !== 'FULL_DAY') {
      setDayPortion('FULL_DAY');
    } else if (isHalfDaySelected && dayPortion === 'FULL_DAY') {
      setDayPortion('FIRST_HALF');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHalfDaySelected]);
```

Add the picker UI right after the "Duration Adjustments" block's closing `</div>` (inside the `{Object.keys(dailyAmounts).length > 0 && (...)}` block, right after the "Total Chargeable Days" line, still inside that same wrapping `<div>`):

```typescript
                          {isHalfDaySelected && (
                            <div className="mt-3">
                              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">Half Day Period</label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDayPortion('FIRST_HALF')}
                                  className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                    dayPortion === 'FIRST_HALF'
                                      ? 'bg-[#1b2559] text-white border-[#1b2559]'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  First Half (AM)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDayPortion('SECOND_HALF')}
                                  className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                    dayPortion === 'SECOND_HALF'
                                      ? 'bg-[#1b2559] text-white border-[#1b2559]'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  Second Half (PM)
                                </button>
                              </div>
                            </div>
                          )}
```

Finally, wire it into submission — update the non-holiday branch of `handleSubmit`:

```typescript
        await submitLeaveRequest({
          leaveTypeId: typeId,
          startDate,
          endDate,
          durationDays: totalDays,
          dayPortion: isHalfDaySelected ? dayPortion : 'FULL_DAY',
          reason,
        });
```

- [x] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/dashboard/RequestModal.test.tsx`
Expected: PASS

- [x] **Step 6: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -i "RequestModal\|employeesApi"`
Expected: no new errors introduced by this task (pre-existing unrelated `TS6133` unused-var warnings in this file are fine to leave, per the file's existing state).

- [x] **Step 7: Commit**

```bash
git add frontend/src/services/employeesApi.ts frontend/src/components/dashboard/RequestModal.tsx frontend/src/components/dashboard/RequestModal.test.tsx
git commit -m "feat: add First/Second Half picker to the leave request form"
```

**Deviations from this plan:** the test's date inputs were driven with `fireEvent.change` (not `screen.getByLabelText` + `user.type` as an earlier draft of this step assumed) because the "From Date"/"To Date" `<label>`s aren't `htmlFor`-linked to their inputs, and native `type="date"` inputs don't accept character-by-character `userEvent.type` reliably in jsdom — the plan text above was already corrected to this before Task 4 was dispatched, so the code matches. After committing, the test was found flaky under a full 14-file parallel suite run (passed standalone, timed out at the 5s default under load) — fixed in commit `8f0564d` by raising it to a 15s timeout; confirmed stable across two full-suite reruns.

---

### Task 5: Frontend — show the AM/PM badge for employees and managers

**Files:**
- Modify: `frontend/src/pages/LeaveTracking.tsx`
- Modify: `frontend/src/pages/LeaveTracking.test.tsx`
- Modify: `frontend/src/pages/ApprovalDashboard.tsx`
- Modify: `frontend/src/pages/ApprovalDashboard.test.tsx`

**Interfaces:**
- Consumes: `dayPortion` field now present on `/leave-requests/my-requests` and `/leave-requests/my-approvals` responses (Task 3).

- [x] **Step 1: Write the failing test (LeaveTracking)**

In `frontend/src/pages/LeaveTracking.test.tsx`, add a second entry to the mocked `/leave-requests/my-requests` response in the existing `beforeEach` (keep the existing `req-101` entry, add this as a second array item):

```typescript
          {
            id: 'req-102',
            leaveTypeId: 'lt-1',
            leaveType: { id: 'lt-1', key: 'annual', label: 'Annual Leave' },
            startDate: '2026-09-10',
            endDate: '2026-09-10',
            durationDays: 0.5,
            dayPortion: 'SECOND_HALF',
            reason: 'Doctor appointment',
            status: 'PENDING',
            createdAt: '2026-09-01T10:00:00.000Z',
            approvalInstances: [],
          },
```

Add a new test at the end of the `describe` block:

```typescript
  it('shows a Second Half badge for a half-day request', async () => {
    render(<LeaveTracking />);

    await waitFor(() => {
      expect(screen.getByText(/Second Half/i)).toBeInTheDocument();
    });
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/LeaveTracking.test.tsx`
Expected: FAIL — no "Second Half" text rendered.

- [x] **Step 3: Implement in `LeaveTracking.tsx`**

Add the field to `RequestItem`:

```typescript
interface RequestItem {
  id: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  dayPortion?: string;
  reason?: string;
```

Add it to the mapping in `loadRequests()`:

```typescript
          durationDays: r.durationDays ?? 1,
          dayPortion: r.dayPortion || 'FULL_DAY',
```

Add a small helper right after `formatDate`:

```typescript
function dayPortionLabel(dayPortion?: string): string | null {
  if (dayPortion === 'FIRST_HALF') return 'First Half';
  if (dayPortion === 'SECOND_HALF') return 'Second Half';
  return null;
}
```

Next to each of the two duration badges (the ones rendering `{req.durationDays === 1 ? 'DAY' : 'DAYS'}`, at the list-row and card-row spots), add a sibling pill right after the badge `</div>`:

```typescript
                        {dayPortionLabel(req.dayPortion) && (
                          <span className="ml-2 text-[9px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {dayPortionLabel(req.dayPortion)}
                          </span>
                        )}
```

(Insert this once after each of the two duration-badge `<div>`s — the list view one and the card view one — as a sibling within their parent flex row.)

In the detail drawer subtitle, extend the existing template literal:

```typescript
        subtitle={selectedReq ? `${selectedReq.leaveTypeName} · ${selectedReq.durationDays} ${selectedReq.durationDays === 1 ? 'day' : 'days'}${dayPortionLabel(selectedReq.dayPortion) ? ' · ' + dayPortionLabel(selectedReq.dayPortion) : ''}` : ''}
```

And in the "Duration" detail row, append the same conditional span after the days text.

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/LeaveTracking.test.tsx`
Expected: PASS (both the new test and the three pre-existing ones).

- [x] **Step 5: Write the failing test (ApprovalDashboard)**

In `frontend/src/pages/ApprovalDashboard.test.tsx`, add `dayPortion: 'FIRST_HALF'` and change `durationDays: 5` to `durationDays: 0.5` **only if you duplicate the mocked item** — instead, add a second mocked approval item to the `/leave-requests/my-approvals` array (keep `req-101` as-is):

```typescript
          {
            stepInstanceId: 'step-102',
            requestId: 'req-102',
            stepOrder: 1,
            approverType: 'MANAGER',
            employeeId: 'emp-2',
            leaveTypeId: 'lt-1',
            employeeName: 'Ahmad Staff',
            leaveTypeName: 'Annual Leave',
            startDate: '2026-09-11',
            endDate: '2026-09-11',
            durationDays: 0.5,
            dayPortion: 'FIRST_HALF',
            reason: 'Personal errand',
            submittedAt: '2026-08-21',
          },
```

Add a test:

```typescript
  it('shows a First Half badge for a half-day approval request', async () => {
    await act(async () => {
      render(<ApprovalDashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText(/First Half/i)).toBeInTheDocument();
    });
  });
```

- [x] **Step 6: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/ApprovalDashboard.test.tsx`
Expected: FAIL — no "First Half" text rendered.

- [x] **Step 7: Implement in `ApprovalDashboard.tsx`**

Add `dayPortion?: string;` to the `MyApprovalItem`-style interface at the top of the file (the one with `durationDays: number;` at line ~25).

Add the same `dayPortionLabel` helper used in Task 5 Step 3 (top-level function in this file too — small enough that duplicating it is fine per this codebase's existing per-file style; do not extract a shared module for two call sites).

Next to the existing duration text (`{req.durationDays} {req.durationDays === 1 ? 'day' : 'days'}` in the card list, and `{request.durationDays} days` in the approve/reject modal), append:

```typescript
                            {dayPortionLabel(req.dayPortion) && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                                  {dayPortionLabel(req.dayPortion)}
                                </span>
                              </>
                            )}
```

(and the equivalent single-span version, without the bullet separator, in the modal.)

- [x] **Step 8: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/ApprovalDashboard.test.tsx`
Expected: PASS

- [x] **Step 9: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -i "LeaveTracking\|ApprovalDashboard"`
Expected: no new errors.

- [x] **Step 10: Commit**

```bash
git add frontend/src/pages/LeaveTracking.tsx frontend/src/pages/LeaveTracking.test.tsx frontend/src/pages/ApprovalDashboard.tsx frontend/src/pages/ApprovalDashboard.test.tsx
git commit -m "feat: show half-day AM/PM badge on employee and manager leave views"
```

**Deviations from this plan:**
- `LeaveTracking.test.tsx`: the plan's Step 1 said to add the half-day request as a *second item in the shared `beforeEach` mock list*. That would have broken the file's other three tests, which all use singular `getByRole('button', { name: /Details/i })` — two list rows means two "Details" buttons, and `getByRole` throws on multiple matches. Fixed instead with a local `mockedApiFetch.mockImplementation` override inside the new test only, keeping it the sole item in that test's list. The other three tests were re-verified to still pass unchanged.
- `ApprovalDashboard.test.tsx`: the plan's Step 5 named the second mocked employee "Ahmad Staff" — same name as the existing mocked employee. `renders pending approval requests for managers` asserts `getByText(/Ahmad Staff/i)` (singular), so a second element with the same name broke it. Renamed the second mock employee to "Sara Khalil"; all three tests (two pre-existing, one new) pass.
Both the mock-list override and the employee rename are in files this task's own text already modifies, so they landed in this task's commit (`69d49b2`), not a separate fix-up.

`ApprovalDashboard.test.tsx`'s pre-existing `handles request approval action` test was separately found flaky under a full-suite parallel run (same 5s-default-timeout class of issue as Task 4's fix) — that one surfaced later, during Task 7's verification, and was bumped to 15s in Task 7's commit (`573fa5d`) alongside the Annual-Leave-only fix; confirmed stable across two full-suite reruns.

---

### Task 6: Frontend — show the AM/PM badge in the HR admin review page

**Files:**
- Modify: `frontend/src/admin/pages/LeaveRequests.tsx`
- Create: `frontend/src/admin/pages/LeaveRequests.test.tsx`

**Interfaces:**
- Consumes: `dayPortion` field now present on `hrFindAll()`'s response, i.e. `GET /leave-requests/hr` (Task 3), returned by `hrGetLeaveRequests()` in `frontend/src/services/adminApi.ts`.

- [x] **Step 1: Write the failing test**

Create `frontend/src/admin/pages/LeaveRequests.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeaveRequests from './LeaveRequests';
import { AdminProvider } from '../store/AdminContext';
import { hrGetLeaveRequests } from '../../services/adminApi';

vi.mock('../../services/adminApi', () => ({
  hrGetLeaveRequests: vi.fn(),
  hrApproveLeaveRequest: vi.fn(),
  hrRejectLeaveRequest: vi.fn(),
  hrDeleteLeaveRequest: vi.fn(),
}));

const mockedHrGetLeaveRequests = vi.mocked(hrGetLeaveRequests);

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminProvider>
        <LeaveRequests />
      </AdminProvider>
    </MemoryRouter>,
  );
}

describe('Admin LeaveRequests half-day badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHrGetLeaveRequests.mockResolvedValue([
      {
        requestId: 'req-1',
        employeeId: 'emp-1',
        employeeName: 'Ahmad Staff',
        department: 'Engineering',
        country: 'Lebanon',
        leaveTypeId: 'lt-1',
        leaveTypeName: 'Annual Leave',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        requestedDuration: 0.5,
        dayPortion: 'FIRST_HALF',
        currentStatus: 'PENDING',
        canApprove: false,
        canReject: false,
        submittedAt: '2026-09-01T10:00:00.000Z',
      } as any,
    ]);
  });

  it('shows a First Half badge in the table for a half-day request', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/First Half/i)).toBeInTheDocument();
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/admin/pages/LeaveRequests.test.tsx`
Expected: FAIL — no "First Half" text rendered (and possibly fails earlier if the page doesn't render at all — confirm the failure is about the missing badge, not a setup error, before proceeding).

- [x] **Step 3: Implement in `LeaveRequests.tsx`**

Add a helper near the top of the file (after the imports):

```typescript
function dayPortionLabel(dayPortion?: string): string | null {
  if (dayPortion === 'FIRST_HALF') return 'First Half';
  if (dayPortion === 'SECOND_HALF') return 'Second Half';
  return null;
}
```

In the table's "Days" cell, append a badge:

```typescript
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {req.requestedDuration}
                        {dayPortionLabel(req.dayPortion) && (
                          <span className="block mt-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                            {dayPortionLabel(req.dayPortion)}
                          </span>
                        )}
                      </td>
```

In the detail drawer's grid, add a conditional entry to the array right after `['Total Days', ...]`:

```typescript
                  ['Total Days', `${selected.requestedDuration} days${dayPortionLabel(selected.dayPortion) ? ' (' + dayPortionLabel(selected.dayPortion) + ')' : ''}`],
```

(replace the existing `['Total Days', ...]` line with this one — no separate array entry needed.)

- [x] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/admin/pages/LeaveRequests.test.tsx`
Expected: PASS

- [x] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -i "admin/pages/LeaveRequests"`
Expected: no new errors.

- [x] **Step 6: Commit**

```bash
git add frontend/src/admin/pages/LeaveRequests.tsx frontend/src/admin/pages/LeaveRequests.test.tsx
git commit -m "feat: show half-day AM/PM badge in the HR leave requests review page"
```

**Deviations from this plan:** none — implemented exactly as written (commit `17ed88f`).

---

### Task 7: Post-rollout fixes (not in the original plan)

**Why:** two problems surfaced only after Task 6 shipped and the feature was tried against the real, running app — one from live manual testing, one from a follow-up user request.

**7a — Migration never applied to the real database.** Task 1 wrote the migration file and committed it, but nobody had run it against the actual (non-test) Postgres database. The first live "Request Time Off" submission after Task 6 shipped failed with `column LeaveRequest.day_portion does not exist` (TypeORM `synchronize: false` never auto-creates columns — only `migration:run` does). Fixed by running:

```bash
cd backend && npm run migration:run
```

Confirmed via `npm run migration:show` that `AddDayPortionToLeaveRequests1787700000000` moved from `[ ]` to `[X]`. No code change — this is a deployment step, not a defect in the written migration. **Any future environment this feature is deployed to needs this same `migration:run` step.**

**7b — Half-day was available on every leave type, not just Annual Leave.** After the fix above, the user reported the "0.5 (Half Day)" option appearing on Sick Leave too, and asked for it to be Annual-Leave-only. Root cause: `RequestModal.tsx`'s synthetic balance fallback (used when a leave type has no configured policy rule yet for that employee — the case here, since this dev database has no Sick Leave rule configured) hardcoded `allowsHalfDay: true` for every leave type, regardless of key. This was a pre-existing bug unrelated to this plan's own tasks (the fallback object literal predates this feature) — this plan's `RequestModal.tsx` changes in Task 4 only added the picker; they didn't touch this fallback line.

Fixed in commit `573fa5d`:
- `frontend/src/components/dashboard/RequestModal.tsx`: the fallback's `allowsHalfDay: true` → `allowsHalfDay: lt.key === 'annual'`.
- `frontend/src/admin/pages/LeavePolicies.tsx`: `defaultQuotaForType`'s seed default `allowsHalfDay: keyLower === 'annual' || keyLower === 'compensation'` → `allowsHalfDay: keyLower === 'annual'` (only affects the pre-filled checkbox when HR creates a *new* policy quota going forward — doesn't retroactively change already-saved policies).
- The real `leaveRule.allowsHalfDay` toggle in Leave Policies (admin-configurable, unchanged) still lets HR opt another leave type in later if they choose — this fix only corrects the default/fallback, not the architecture.

Same commit also bumped `ApprovalDashboard.test.tsx`'s `handles request approval action` timeout to 15s (see Task 6's deviation note) after it was caught flaking under a full-suite run while re-verifying this fix.

No new automated test was added for 7b specifically — it's a one-line default-value change in two files, verified by re-running the full frontend suite twice (39/39 both times) plus a manual check in the running app that Sick Leave no longer offers the half-day option while Annual Leave still does.

---

## Post-Plan Manual Verification

**Status: ✅ Done**, via Task 7 above (this ran the migration and confirmed the flow end-to-end during live troubleshooting, rather than as one standalone verification pass).

After all tasks: start the backend, run its migrations — `cd backend && npm run migration:run` (confirm with `npm run migration:show` that every row shows `[X]`, including `AddDayPortionToLeaveRequests1787700000000`) — then in the running app: submit a single-day Annual Leave request, select the `0.5 (Half Day)` amount, pick `Second Half (PM)`, submit, and confirm (a) the balance dropped by exactly 0.5 in the employee's "Leave Balance" card, and (b) the "Second Half" badge shows on the employee's Approval Progress list, the manager's Approval Dashboard, and the HR admin's Leave Requests page. Also confirm the half-day amount option is absent for a leave type other than Annual Leave (e.g. Sick Leave) — this is what Task 7b fixed.
