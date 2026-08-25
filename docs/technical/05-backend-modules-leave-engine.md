# Backend Modules — Leave Engine

Covers `leave-requests/` and `approval-workflows/` — the core submission/approval state
machine. Entities documented in [Database Schema](03-database-schema-and-migrations.md).
`leave-requests` has **no `dto/` folder** — the controller types bodies as inline plain
interfaces, with no `class-validator` decorators, unlike `approval-workflows`'s DTOs.

## Submission — `LeaveRequestsService.create()` (`leave-requests.service.ts:44-223`)

1. `startDate > endDate` → `BadRequestException` (`:49-51`). No other date-format check.
2. Loads employee with `manager` relation.
3. Raw query for an **active** `EmployeePolicyAssignment` → 400 if none.
4. Raw query joining `leave_rules`→`approval_workflows` on `policy_id`+`leave_type_id`+
   `aw.status='ACTIVE'` (`:78-92`). **This does not filter by `effectiveFrom`/`effectiveTo`**
   and does **not** reuse `ApprovalWorkflowsService.resolveWorkflow()` (which does filter by
   date range) — two independent, inconsistent code paths for "the active workflow." See
   [Known Issues](14-known-issues-and-technical-debt.md).
5. Fetches the full workflow+steps (`ApprovalWorkflowsService.findOne()`).
6. **Per-step approver resolution** (`:104-155`):
   - `MANAGER` → `employee.managerId`, 400 if unset.
   - `MANAGERS_MANAGER` → `employee.manager.managerId`, 400 if either link is unset.
   - `SPECIFIC_PERSON` → `step.specificApproverId` directly, or resolves an `Employee` by
     `step.specificApproverEmail`; 400 if neither present or lookup fails.
   - `HR` → `resolvedApproverId` left `null`, resolved at **action time** to whichever
     `HR_ADMIN` acts (fan-out).
7. Leave type must exist in `calculateBalancesForEmployee()`'s output for this employee, else
   400 — **overdraft is explicitly permitted**, no balance-sufficiency check blocks
   submission (`:163`).
8. Builds and stores `workflowSnapshot` (frozen workflow+steps JSON) on the request.
9. Creates `LeaveRequest` (`status: PENDING`).
10. Creates one `ApprovalInstance` per resolved step — **only `stepOrder===1` starts
    `PENDING`; all others start `WAITING`**.
11. Audit-logs `LEAVE_REQUEST_SUBMITTED`.

### Validations confirmed absent from `create()` — server side only

**None** of the following are checked by this backend method — the DTO-less controller body
accepts whatever `durationDays`/dates it's given: overlap with other requests (own or anyone
else's), balance-sufficiency, minimum-notice period, weekend/holiday exclusion from
`durationDays`, max-consecutive-days, min/max-request-days, `requiresNote`/`requiresDocument`,
`allowedCountries`/waiting-period eligibility, or gender-based restriction (no gender field
exists on `LeaveType`/`LeaveRule` at all — see
[Balances & Policies](06-backend-modules-balances-and-policies.md)). A request sent directly
to `POST /leave-requests` (bypassing the frontend form) is not re-validated against any of
this.

**However, most of these ARE enforced by the standard frontend form** before it ever calls
this endpoint — see `frontend/src/components/dashboard/RequestModal.tsx:208-270`:
- Start/end date not in the past, end not before start.
- No overlap with the **same employee's own** other `PENDING`/`APPROVED` requests (computed
  client-side against their already-loaded request list — not a server check).
- `minRequestDays`, `maxRequestDays`, `maxConsecutiveDays` (from the resolved `LeaveRule`) —
  blocks submission if violated.
- Eligibility (`eligible`/`ineligibilityReasons`) from `GET /employees/:id/leave-configuration`
  — i.e. the country/waiting-period checks documented in
  [Org & People modules](04-backend-modules-org-and-people.md#service-logic-beyond-crud-employeesservicets)
  ARE surfaced and enforced here, just via a separate read endpoint + client-side gating
  rather than inside `create()` itself.
- `requiresNote` blocks submission without a note. **`requiresDocument` unconditionally
  blocks submission** (`RequestModal.tsx:238`, message: "Secure attachment service is
  missing") — there is no file-upload mechanism anywhere in the stack (no `multer`/
  `FileInterceptor` in the backend, no file input in the frontend), so **any leave type with
  `requiresDocument: true` can never be submitted through the normal UI**. See
  [Known Issues](14-known-issues-and-technical-debt.md).
- Overdraft produces a non-blocking warning (`overdraftWarning`), matching the backend's
  explicit no-block-on-overdraft behavior.
- **Not enforced anywhere, frontend or backend**: minimum notice period, carry-over/reset,
  and overlap with *other* employees' leave (that's a reporting-only concern — see
  [Reports](07-backend-modules-reminders-mail-audit-reports.md#reports-modulereports)).

The practical implication: correctness of these rules today depends entirely on the frontend
form being the only way requests are created. Any other client of the API (a script, a future
mobile app, Swagger's "Try it out") bypasses every one of them except what's listed as
"absent" above being genuinely absent everywhere.

## Approval workflow engine (`approval-workflows/`)

- Workflows are configurable, scoped by **country + leave type + effective date range**;
  both scoping fields `null` = a "general" workflow.
- `validateSteps()` (`approval-workflows.service.ts:31-48`) hard-enforces **1–3 steps**,
  unique `stepOrder`s. It does **not** validate `SPECIFIC_PERSON` steps having an id/email set
  (comment: "managed via Leave Policies") — `approval-workflows.service.spec.ts:53-84`'s
  tests for that validation **do not match current behavior**, a discovered discrepancy.
- Per-employee, the workflow actually used comes from the `LeaveRule` join in `create()` step
  4 above — **not** from `resolveWorkflow()`, which is only reachable via the standalone
  `GET /approval-workflows/resolve` endpoint and isn't used internally.
- **`checkOverlap()`** (`:318-361`): rejects creating two overlapping `ACTIVE` workflows for
  the same country+leaveType+date-range scope.
- **Deletion** (`remove()`, `:242-298`): any `LeaveRule` referencing the deleted workflow is
  re-pointed to a fallback (oldest other workflow) if one exists, else blocked with
  `ConflictException`; `ApprovalInstance` rows and `Employee.approvalWorkflowId` references
  are cleaned up first.

### Endpoints (base `/v1/approval-workflows`) — **no guards at all**, not even `AdminGuard`
| Method | Path | Notes |
|---|---|---|
| POST | `/` | Create workflow + steps; only checks `x-employee-id` presence |
| GET | `/resolve` | Resolve active workflow by country/leaveType/effectiveDate (unused internally) |
| GET | `/` | Paginated list with steps |
| GET | `/:id` | One workflow with steps |
| PUT | `/:id` | Atomically replaces all steps; header presence only |
| DELETE | `/:id` | 204, cascading cleanup; header presence only |

Any employee id — not just HR_ADMIN — can create/update/delete approval workflows per this
code. See [Known Issues](14-known-issues-and-technical-debt.md).

## Step advancement — `finalizeApprovedStep()` (`leave-requests.service.ts:325-418`)

- Approves `currentStep`, audit-logs `APPROVAL_STEP_APPROVED`.
- Finds `nextRequiredStep` = next step by order where `isRequired ?? true`.
- Any step strictly between current and next-required is marked `SKIPPED`
  (`APPROVAL_STEP_SKIPPED`). If there's no next required step, **all** remaining steps are
  skipped and the whole `LeaveRequest` → `APPROVED`, setting `reviewerId`/`reviewedAt`, then
  `applyLedger(..., USAGE, ...)` exactly once, then `LEAVE_REQUEST_APPROVED`.
- "Optional" (`isRequired:false`) steps are purely decorative — never set to `PENDING`, always
  skipped over.

### Approver resolution recap
`MANAGER` → direct manager · `MANAGERS_MANAGER` → manager's manager · `SPECIFIC_PERSON` →
fixed id/email · `HR` → any `HR_ADMIN`, resolved at action time. No "department head"
resolution exists despite the dormant `departmentId`/`specificApproverEmployeeId` columns on
`ApprovalWorkflowStep`.

### Concurrency
`approveStep`, `rejectStep`, `cancel`, `hrDelete` all take a `pessimistic_write` lock on the
`LeaveRequest` row before re-reading with relations, serializing concurrent decisions.

### Auto-approval on timeout
`ExpiredRequestsSchedulerService` (`EVERY_DAY_AT_1AM`) → `processExpiredRequests()`
(`:453-472`) finds `PENDING` requests whose current step has sat ≥5 days →
`autoApproveExpiredStep()` (`:425-451`) reuses `finalizeApprovedStep` with `actorId: null` and
note `'Auto-approved: exceeded 5-day pending threshold'`. Only advances the current step.

## Cancellation — `cancel()` (`leave-requests.service.ts:590-659`)

Employee-owned only (query includes `employeeId`). `CANCELLED` is idempotent; `REJECTED` →
400. **Both `PENDING` and `APPROVED` can be cancelled, no date check, no extra approval
required to cancel an approved request.** Any `WAITING`/`PENDING` instances → `SKIPPED`;
status → `CANCELLED`; audit-logs `LEAVE_REQUEST_CANCELLED`; if it had been `APPROVED`,
`applyLedger(..., REVERSAL, ...)`. Controller exposes both `PATCH` and `PUT :id/cancel` →
same handler.

## Rejection — `rejectStep()` (`leave-requests.service.ts:474-588`)

Requires non-empty `reason`. Only acts on the currently `PENDING` instance. Authorization: HR
steps require `actor.role === HR_ADMIN`; other steps require `resolvedApproverId === actorId`,
else `ConflictException` (note: `approveStep`'s analogous mismatch throws
`ForbiddenException` instead — inconsistent exception type between the two methods). Rejection
stops the **whole chain** — every remaining step → `SKIPPED` regardless of `isRequired`.
`LeaveRequest` → `REJECTED` with `rejectionReason`/`reviewerId`/`reviewedAt`. No ledger effect
(usage was never applied pre-full-approval). **No resubmission path exists** — a rejected
request can't be cancelled or re-approved; the only way forward is a brand-new `create()`.

## Controller endpoints (`leave-requests.controller.ts`, base `/v1/leave-requests`)

Static routes are declared before `:id` deliberately to avoid Nest routing collisions.

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/` | header only | Submit |
| GET | `/my-approvals` | header only | Pending steps for caller |
| GET | `/my-requests`, `/my` | header only | Caller's own requests (two aliases) |
| GET | `/whos-out` | none | Dashboard feed |
| GET | `/calendar` | header only | Scoped calendar (self/team/all) |
| GET | `/hr` | `AdminGuard` | HR filterable view |
| PUT | `/hr/:id/approve` | `AdminGuard` | HR override-approve |
| PUT | `/hr/:id/reject` | `AdminGuard` | HR override-reject |
| PUT | `/hr/:id/delete` | `AdminGuard` | Hard-delete → `DELETED_BY_HR` |
| GET | `/:id/approval-progress` | header only | Full step timeline |
| GET | `/team-availability/overview` | header only | Manager/HR team availability |
| GET | `/:id/team-availability` | header only | Team availability for one request's window |
| GET | `/:id` | header only | Fetch one, ownership-checked |
| PUT | `/:id/approve`, `/:id/reject` | header only | Approve/reject current step |
| PATCH`/`PUT `/:id/cancel` | header only | Cancel (both verbs, same handler) |

## Touchpoint with leave-balances

Balance is untouched at submission except confirming the leave type exists in the calculated
balances. **Deduction happens only on final approval**, in the same DB transaction, via
`LeaveRequestsService.applyLedger(em, request, USAGE, actorId)` (`:961-1005`) — this method
directly creates/updates `LeaveBalance` and `LeaveLedgerEntry` rows via the injected
`EntityManager` (not by calling into `LeaveBalancesService`), pessimistic-locking the balance
row. `LeaveType.trackingMode` decides whether the write targets `usedYtd` (`USAGE_YTD`) or
`availableBalance` (`AVAILABLE_BALANCE`). Cancellation of an approved request or HR-delete of
an approved request both call the same helper with `REVERSAL`. Every ledger mutation is also
audit-logged (`LEDGER_USAGE_CREATED`/`LEDGER_REVERSAL_CREATED`).
