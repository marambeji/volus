# Database Schema and Migrations

PostgreSQL via TypeORM. Entities live under each module's `entities/` folder; migrations are
hand/CLI-generated under `backend/src/database/migrations/`, run against
`backend/src/database/data-source.ts`.

## Enums {#enums}

All defined in `backend/src/common/enums/index.ts`:

| Enum | Values |
|---|---|
| `LeavePolicyStatus` | `DRAFT`, `ACTIVE`, `INACTIVE` |
| `ApprovalWorkflowStatus` | `ACTIVE`, `INACTIVE` |
| `ApproverType` | `MANAGER`, `MANAGERS_MANAGER`, `SPECIFIC_PERSON`, `HR` |
| `AccrualInterval` | `MONTHLY`, `YEARLY` |
| `CutOffType` | `FIXED_DATE`, `HIRE_DATE` |
| `ResetType` | `NONE`, `YEARLY`, `POLICY_CUTOFF` |
| `LeaveTrackingMode` | `AVAILABLE_BALANCE`, `USAGE_YTD` |
| `EmploymentType` | `FULL_TIME`, `PART_TIME`, `CONTRACTOR`, `INTERN` |
| `WorkMode` | `ONSITE`, `HYBRID`, `REMOTE` |
| `EmployeeStatus` | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `EmployeeRole` | `HR_ADMIN`, `MANAGER`, `EMPLOYEE` |
| `Gender` | `MALE`, `FEMALE` |
| `LedgerTransactionType` | `INITIAL_GRANT`, `ACCRUAL`, `USAGE`, `REVERSAL`, `MANUAL_ADJUSTMENT`, `CARRY_OVER`, `RESET` |
| `LeaveRequestStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `DELETED_BY_HR` |
| `ApprovalInstanceStatus` | `WAITING`, `PENDING`, `APPROVED`, `REJECTED`, `SKIPPED` |
| `AuditActionType` | `WORKFLOW_CREATED/UPDATED/DELETED`, `LEAVE_REQUEST_SUBMITTED/APPROVED/REJECTED/CANCELLED/DELETED_BY_HR`, `APPROVAL_STEP_APPROVED/REJECTED/SKIPPED`, `LEDGER_USAGE_CREATED`, `LEDGER_REVERSAL_CREATED`, `BALANCE_ADJUSTED` *(unused — see below)*, `EMPLOYEE_CREATED/UPDATED/DELETED`, `POLICY_ASSIGNED` *(unused)* |
| `CalendarScope` | `self`, `team`, `all` (lowercase values) |

`BALANCE_ADJUSTED` and `POLICY_ASSIGNED` are handled in `AuditLogsService.buildAuditDescription()`'s
switch but no `.log(...)` call anywhere in the backend passes either value — dead branches.

## Entities

### `Employee` (`employees/entities/employee.entity.ts`) — table `employees`
`id` (uuid PK) · `employeeNumber` *(column exists but dropped by migration 20 — see below,
verify against current migration head)* · `fullName` · `email` · `phone` · `avatar` ·
`jobTitle` · **`department: string`** (plain varchar — **not** a FK to the `Department`
entity) · `unit` · `managerId` + self-referencing `manager: ManyToOne<Employee>`
(`onDelete:'SET NULL'`) / inverse `directReports: OneToMany<Employee>` · `countryId` +
`country: ManyToOne<Country>` (`onDelete:'RESTRICT'`) · `divisionId` +
`division: ManyToOne<Division>` (`onDelete:'SET NULL'`) · `approvalWorkflowId` +
`approvalWorkflow: ManyToOne<ApprovalWorkflow>` (`onDelete:'SET NULL'`) · `status: EmployeeStatus`
(default `ACTIVE`) · `employmentType` (default `FULL_TIME`) · `workMode` (default `ONSITE`) ·
`role: EmployeeRole` (default `EMPLOYEE`) · `hireDate` · `gender?: Gender` (nullable) ·
`emergencyContacts: EmergencyContact[]` (jsonb, `{name,relationship,phone}[]`, max 5) ·
`policyAssignments: OneToMany<EmployeePolicyAssignment>` · soft-delete `deletedAt`.

`EmployeePolicyAssignment` (`employees/entities/employee-policy-assignment.entity.ts`): links
one `Employee` to one `LeavePolicy` for an `effectiveFrom`/`effectiveTo` window, `isActive`
flag. An employee can have multiple historical assignments but should have exactly one active
one at a time (enforced only in application logic, not a DB constraint).

### `Department` (`departments/entities/department.entity.ts`) — table `departments`
`id`, `name` (unique), `color` (default `#8B5CF6`), `headEmployeeId` + `headEmployee: ManyToOne<Employee>`
(`SET NULL`). **No relation from `Employee`** — `Employee.department` is a free-text string,
structurally disconnected from this table.

### `Division` (`divisions/entities/division.entity.ts`) — table `divisions`
`id`, `name` (unique). Target of `Employee.division` (`ManyToOne`, `SET NULL` on delete).

### `Country` (`countries/entities/country.entity.ts`) — table `countries`
`id`, `name` (indexed), `code` (indexed, ≤3 chars), `flag`. Target of `RESTRICT`-on-delete
relations from `Employee`, `PublicHoliday`, and `LeavePolicy`.

### `PublicHoliday` (`public-holidays/entities/public-holiday.entity.ts`) — table `public_holidays`
`id`, `name`, `date` (stored `YYYY-MM-DD`), `country: ManyToOne<Country>` (`RESTRICT`) +
`countryId`, `isRecurring` (default `false`). Scoped per country only (plus the "Global"
pseudo-country convention — see [module doc](04-backend-modules-org-and-people.md)).

### `LeaveType` (`leave-types/entities/leave-type.entity.ts`) — table `leave_types`
`id`, `key` (unique), `label`, `trackingMode: LeaveTrackingMode`, `color` (default `#3B82F6`),
`displayOrder`, `isActive`. No paid/unpaid flag, no gender flag, no per-type weekend/holiday
counting flag.

### `LeavePolicy` (`policies/entities/leave-policy.entity.ts`) — table `leave_policies`
`id`, `policyName`, `country: ManyToOne<Country>` (eager, one country per policy),
`workingHoursPerDay`, `weekendDays: number[]` (0=Sun..6=Sat), `status: LeavePolicyStatus`
(default `DRAFT`), `divisions: ManyToMany<Division>` (eager, via join table
`leave_policy_divisions` — descriptive/filter tag only, does not affect assignment), `rules: OneToMany<LeaveRule>` (cascade).

### `LeaveRule` (`policies/entities/leave-rule.entity.ts`) — table `leave_rules`
One row per (policy, leave type). Key fields: `approvalWorkflowId` (required — every rule
must reference a workflow), `entitlementDays`, `isAccrued`, `accrualRate`,
`accrualInterval: AccrualInterval`, `cutOffType`/`cutOffMonth`/`cutOffDay`, `resetType`/
`resetDaysCount`, `carryOverEnabled`/`maxCarryOver`/`carryOverExpirationEnabled`/
`carryOverExpirationDays`, `maxConsecutiveDays`, `minNoticeDays` (default 0), `maxBalanceCap`,
`waitingPeriodDays` (default 0), `allowsHalfDay`, `requiresNote`, `requiresDocument`,
`requiresPositiveBalance` (default `true`), `minRequestDays` (default 0.5), `maxRequestDays`,
`allowedCountries: string[]` (jsonb, nullable), `milestones: OneToMany<SeniorityMilestone>`.
**Only `entitlementDays`, `isAccrued`/`accrualRate`/`accrualInterval`/`maxBalanceCap`, and
`requiresPositiveBalance` (at approval time, frontend-side) are actually read by any service
logic** — the rest are stored/validated on the DTO but never consulted by
`leave-requests.service.ts` or `leave-balances.service.ts`. See
[Known Issues](14-known-issues-and-technical-debt.md).

### `SeniorityMilestone` (`policies/entities/seniority-milestone.entity.ts`)
Per-rule tenure bands (`serviceYearsFrom`/`To`, `accrualRate`, `entitlementDays`, `cap`).
Persisted and returned by the Policies CRUD, but **never read** by `runAccruals()` — dead for
calculation purposes.

### `LeaveBalance` (`leave-balances/entities/leave-balance.entity.ts`) — table `leave_balances`
Composite identity `(employeeId, leaveTypeId, year)`. `leavePolicyRuleId` (nullable FK),
`availableBalance`, `usedYtd`, `pending` (column exists but is **never written** —
pending-days display is computed live from `LeaveRequest` rows instead, not read from this
column), `carriedOver` (also **never written**), `ledgerEntries: OneToMany<LeaveLedgerEntry>`.

### `LeaveLedgerEntry` (`leave-balances/entities/leave-ledger-entry.entity.ts`) — table `leave_ledger_entries`
Immutable: `balanceId`, `employeeId`, `leaveTypeId`, `transactionType: LedgerTransactionType`,
`transactionDate` (`@CreateDateColumn`), `signedAmount` (+credit/−debit), `resultingBalance`
(snapshot), `reason`, `referenceType`/`referenceId` (polymorphic, e.g. `'LEAVE_REQUEST'` +
request id), `idempotencyKey` (unique, dedup), `requestFingerprint` (sha256), 
`performedByEmployeeId?` (`SET NULL` — null means system/cron).

### `LeaveRequest` (`leave-requests/entities/leave-request.entity.ts`) — table `leave_requests`
`id`, `employeeId`+`employee` (`RESTRICT`), `leaveTypeId`+`leaveType` (`RESTRICT`),
`startDate`/`endDate`, `durationDays` (numeric, transformer-parsed to float), `status`
(default `PENDING`), `reason`, `reviewedAt`, `reviewerId`+`reviewer` (`SET NULL`),
`rejectionReason`, `workflowSnapshot` (jsonb — frozen copy of the resolved workflow+steps at
submission time), `deletionReason`/`deletedAt`/`deletedById` (HR hard-delete audit trail),
`approvalInstances: OneToMany<ApprovalInstance>` (cascade).

### `ApprovalInstance` (`leave-requests/entities/approval-instance.entity.ts`) — table `approval_instances`
One row per resolved step of a request's workflow. `requestId`+`request` (`CASCADE`),
`workflowId`+`workflow` (`RESTRICT`), `stepId`+`step` (`RESTRICT`), `stepOrder`,
`approverType`, `resolvedApproverId?`+`resolvedApprover` (`RESTRICT`, null for `HR` steps
until acted on), `status` (default `WAITING`), `decisionNote`, `actionDate`.

### `ApprovalWorkflow` (`approval-workflows/entities/approval-workflow.entity.ts`) — table `approval_workflows`
`id`, `name` (unique), `description`, `status` (default `ACTIVE`), `countryId`/`leaveTypeId`
(**plain uuid columns, not relation objects** — no eager Country/LeaveType load from this
side), `effectiveFrom` (required), `effectiveTo` (nullable), `createdBy`/`lastModifiedBy`
(actor-id strings), `steps: OneToMany<ApprovalWorkflowStep>` (cascade).

### `ApprovalWorkflowStep` (`approval-workflows/entities/approval-workflow-step.entity.ts`) — table `approval_workflow_steps`
`workflowId`+`workflow` (`CASCADE`), `stepOrder`, `approverType`, `specificApproverId?`,
`specificApproverEmail?`, `departmentId?` (plain string, **unused by any resolution logic**),
`specificApproverEmployeeId?` (**also unused** — duplicates `specificApproverId`'s intent),
`isRequired` (default `true`).

### `ReminderSettings` (`leave-reminders/entities/reminder-settings.entity.ts`) — table `reminder_settings`
Singleton row: `enabled` (default `true`), `delayHours` (default `48`), `updatedById?`.

### `LeaveReminderNotification` (`leave-reminders/entities/leave-reminder-notification.entity.ts`) — table `leave_reminder_notifications`
One row per `(approvalInstance, approver)` sent — enforced by a unique index so the same
approver is never reminded twice for the same step. `approvalInstanceId`, `requestId`,
`approverId`, `approverEmail`, `sentAt`.

### `AuditLog` (`audit-logs/entities/audit-log.entity.ts`) — table `audit_logs`
`actorId?`+`actor?` (`SET NULL`), `actorName`, `actorRole`, `actionType: AuditActionType`,
`entityType`, `entityId`, `timestamp` (`@CreateDateColumn`), `oldValues?`/`newValues?`/
`changedFields?` (jsonb), `reason?`, `correlationId?`, `description?` (generated at log time).

## Migrations (chronological)

| # | File | What it does |
|---|---|---|
| 1 | `1721498400000-InitialSchema` | Base enums + `countries`, `divisions`, `leave_types`, `approval_workflows`, `approval_workflow_steps`, `public_holidays`, `leave_policies`, `leave_policy_divisions`, `leave_rules`, `seniority_milestones` |
| 2 | `1721498500000-AddSpecificApproverEmail` | Adds `specific_approver_email` to `approval_workflow_steps` |
| 3 | `1721584800000-CreateEmployeesAndBalances` | `employees` (self-FK manager), `employee_policy_assignments`, `leave_balances`, `leave_ledger_entries` |
| 4 | `1784660400000-AddLeaveConfigurationFields` | Renames `max_consecutive`→`max_consecutive_days`; adds `allows_half_day`, `requires_note`, `requires_document`, `requires_positive_balance`, `min_request_days`, `max_request_days`, `allowed_countries` + check constraints |
| 5 | `1784677005679-AddHRReviewFields` | Large auto-generated FK/enum-rename migration; net-new: creates `leave_requests` |
| 6 | `1784680000000-WorkflowAndAuditSchema` | Creates `audit_logs`; adds scoping fields to `approval_workflows`; adds a Postgres trigger `check_workflow_overlap()`; adds `workflow_snapshot` to `leave_requests`; creates `approval_instances`; unique partial indexes for one USAGE/REVERSAL ledger entry per referenced request |
| 7 | `1784760000000-AddDescriptionToAuditLogs` | Adds nullable `description` to `audit_logs` |
| 8 | `1784770000000-AddUniqueLedgerConstraints` | Duplicate/additional unique partial indexes on `leave_ledger_entries.reference_id` |
| 9 | `1784780000000-AddSpecificApproverDepartmentAndEmployeeId` | Adds `department_id` (uuid) + `specific_approver_employee_id` to `approval_workflow_steps` |
| 10 | `1784780000001-AddSpecificApproverDepartmentAndEmployeeId` | Re-adds `department_id` as `VARCHAR(255)`, superseding #9's uuid type |
| 11 | `1784790000000-CreateLeaveReminders` | `reminder_settings` (seeded singleton), `leave_reminder_notifications` |
| 12 | `1784800000000-CreateDepartments` | `departments` table + seeds 9 default rows |
| 13 | `1784810000000-DropSoftDeleteFromRefData` | Drops `deletedAt` from `departments`/`divisions`/`countries`/`leave_types`/`leave_policies`/`approval_workflows` (hard deletes from here on); updates `check_workflow_overlap()` |
| 14 | `1784820000000-AddGenderToEmployees` | Adds `gender` enum column to `employees` |
| 15 | `1784830000000-CascadePolicyDeletion` | Switches policy→assignment→balance→ledger FKs to `CASCADE` |
| 16 | `1784840000000-RestrictBalanceCascade1784840000000` | Partially reverts #15: balance/ledger FKs back to `RESTRICT`, since ordinary rule edits were wiping data via the cascade |
| 17 | `1784850000000-MoveApprovalWorkflowToLeaveRules` | Moves `approval_workflow_id` from `leave_policies` to `leave_rules` (per-leave-type workflow, not per-policy) |
| 18 | `1784860000000-MakeApprovalWorkflowFieldsOptional` | `approval_workflows.country_id`/`leave_type_id` become nullable |
| 19 | `1784870000000-DropCheckWorkflowStepSpecificPerson` | Drops the `CHK_workflow_step_specific_person` check constraint |
| 20 | `1784870000000-RemoveEmployeeNumberAndMakePhoneRequired` | Backfills `phone`→`'N/A'`, makes it `NOT NULL`, **drops `employee_number` entirely** |
| 21 | `1784880000000-AddHrDeleteToLeaveRequests` | Extends `leave_requests_status_enum` with `DELETED_BY_HR`; adds `deletion_reason`/`deleted_at`/`deleted_by_id` |

> Migrations #19 and #20 share the identical timestamp prefix `1784870000000`. Their relative
> order is whatever `data-source.ts`'s explicit migration array says (both are imported
> individually, not glob-loaded) — double check `data-source.ts`'s array order before relying
> on execution order between the two if writing a new migration that touches either's target
> tables.

## Seed script (`backend/src/database/seeds/seed.ts`, run via `npm run seed`)

Connects with a fresh raw `DataSource`, wraps everything in one transaction, and is
idempotent (every insert existence-checked first). Seeds:
- 10 leave types (`annual`, `public_holiday`, `compensation`, `overtime` = `AVAILABLE_BALANCE`;
  `sick`, `maternity`, `paternity`, `bereavement`, `unpaid`, `other` = `USAGE_YTD`).
- 5 countries (LB, AE, SA, GB, FR).
- 5 divisions (Levant, Gulf, Europe, Africa, Global).
- 1 default approval workflow ("Default Manager Approval", single `MANAGER` step).
- 1 default policy ("Standard Global Leave Policy", Lebanon, `workingHoursPerDay: 8`,
  weekends Sat/Sun) with 5 rules (annual 20d, sick 10d, unpaid 0d, maternity 90d,
  bereavement 3d — all non-accrued, `HIRE_DATE` cutoff, `NONE` reset).
- 3 sample employees: HR Admin User (`HR_ADMIN`), Gabriel Habre (`MANAGER`), Maram El-Din
  (`EMPLOYEE`) — each with an active policy assignment and an Annual Leave balance
  (20 available) plus a matching `INITIAL_GRANT` ledger entry.

**Departments are not seeded by this script** — they come from migration #12 instead. Two
separate mechanisms; don't assume running `npm run seed` alone gives you departments.
