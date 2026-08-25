# Known Issues and Technical Debt

A consolidated list of everything discovered during a full code review that a future
maintainer should know about before assuming a configured feature works, or before extending
the areas involved. Each item links back to the chapter with full detail.

## Security

1. **No real authentication.** Identity is a client-supplied `x-employee-id` header, trusted
   at face value; login only checks that an email exists and is `ACTIVE`, no password. See
   [Authentication and Authorization](02-authentication-and-authorization.md).
2. **`AdminGuard` is missing from most HR-intended endpoints**, most notably every mutating
   `approval-workflows` endpoint (create/update/delete "Approval Levels") — any employee id
   can currently create/edit/delete approval workflows. Also missing on `employees`,
   `departments`, `divisions`, `countries`, `public-holidays`, `leave-types`, `policies`, and
   `leave-balances` (including manual balance adjustment). Only `leave-reminders` (whole
   controller), `audit-logs/global`, and the four `leave-requests/hr/*` routes are actually
   guarded.
3. **`process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`** is set globally at backend bootstrap
   (`main.ts:5`), disabling TLS certificate validation for the entire process, not just the
   DB connection.
4. `frontend/src/components/ui/Chatbot.tsx` calls the Google Gemini API directly from the
   browser using a client-exposed API key (`VITE_GEMINI_API_KEY` or `localStorage`) — anyone
   opening browser dev tools can extract and reuse the key.

## Configuration inconsistencies

5. **Database SSL settings are computed three different ways** across `env.config.ts` (always
   SSL-on, cert-check always off, ignoring `.env`), `env.validation.ts` (treats them as real
   independent toggles, opposite defaults), and `data-source.ts`/seed script (a third,
   different real-toggle behavior). See
   [Configuration](11-configuration-and-environment.md#⚠️-ssl-handling-is-inconsistent-across-three-code-paths).

## Configured but not enforced (the biggest category)

6. Several `LeaveRule` fields are fully modeled (entity, DTO validation, admin UI) but **never
   read by the backend** at submission time: `minNoticeDays`, `maxConsecutiveDays`,
   `minRequestDays`, `maxRequestDays`, `requiresNote`, `requiresDocument`, `allowedCountries`.
   `requiresPositiveBalance` is only checked at **approval** time (and only in the
   manager-facing frontend), never at submission. **Correction/nuance**: most of these (min/
   max/consecutive days, note requirement, country/waiting-period eligibility) ARE enforced by
   the standard frontend request form (`RequestModal.tsx`) before submission — only
   `minNoticeDays`, carry-over/reset, and cross-employee overlap detection are unenforced
   *everywhere*, frontend and backend alike. See
   [Leave Engine](05-backend-modules-leave-engine.md#validations-confirmed-absent-from-create-server-side-only)
   for the full breakdown of what's checked where.
6a. **`requiresDocument` is a functional dead-end**: enabling it on any leave type makes that
    leave type permanently unsubmittable through the normal UI, since no file-upload
    mechanism exists anywhere in the stack (frontend or backend). `RequestModal.tsx:238`
    always shows "Secure attachment service is missing" and blocks the submit button. Do not
    enable this flag until file attachments are implemented.
7. **Carry-over and year-end reset are entirely unenforced** — `carryOverEnabled`,
   `maxCarryOver`, `carryOverExpirationEnabled`/`Days`, `resetType`/`resetDaysCount` are all
   configurable but no code anywhere writes a `CARRY_OVER` or `RESET` ledger entry; the only
   scheduled job is monthly accrual. See
   [Balances & Policies](06-backend-modules-balances-and-policies.md#carry-over--expiry--gender--confirmed-dead-or-absent).
8. **`SeniorityMilestone` tenure-based accrual tiers are never consulted** by `runAccruals()`
   — accrual always uses the flat `LeaveRule.accrualRate` regardless of configured milestones.
9. **No gender-based leave eligibility exists anywhere in the backend** — `Employee.gender` is
   stored but not read by `leave-types`, `policies`, or `leave-requests`. The only place
   gender has any effect is a cosmetic filter in the admin frontend's Balance Management
   screen (hides Maternity for male / Paternity for female employees) — client-side display
   only.
10. **Overdraft is explicitly allowed** at submission — no balance-sufficiency check blocks a
    request from being created even with insufficient balance.
11. `LeaveBalance.pending` and `LeaveBalance.carriedOver` columns exist but are **never
    written** — "pending" is instead computed live from `PENDING` `LeaveRequest` rows every
    time balances are calculated.

## Dead code / unused surface area

12. `ApprovalWorkflowStep.departmentId` and `.specificApproverEmployeeId` (entity + DTO
    fields) are never read by any approver-resolution logic.
13. `AuditActionType.BALANCE_ADJUSTED` and `.POLICY_ASSIGNED` are handled in
    `buildAuditDescription()`'s switch but have zero `.log(...)` call sites anywhere.
14. `LeaveBalancesController.adjust()` never passes a `performerEmployeeId` to the service, so
    `LeaveLedgerEntry.performedByEmployeeId` is always `null` for manual adjustments made via
    the HTTP API, even though the service signature supports recording it.
15. Frontend: `admin/store/AdminContext.tsx`'s `leaveRequests`, `leaveLedger`, `holidays`,
    `auditLog`, `notifications`, and `approvalLevels` state slices (and their mock-CRUD
    reducer actions) are seeded from `admin/data/adminMockData.ts` and never overwritten by
    any real page — every page dealing with those concepts fetches live data directly
    instead. Only `employees`/`policies`/`leaveBalances` are real. See
    [Frontend Architecture](09-frontend-architecture.md#admin-storeadmincontexttsx--mostly-legacy).
16. Frontend: `admin/components/ui/PolicyDetailsModal.tsx` and
    `admin/utils/leaveCalculator.ts` appear unused by any page reviewed.
17. `components/dashboard/ApprovalProgressSection.tsx` looks like an earlier version of what
    `LeaveTracking.tsx` now does, and isn't wired into `Home.tsx`.

## Test / implementation mismatches

18. `approval-workflows.service.spec.ts` expects `validateSteps()` to throw for a
    `SPECIFIC_PERSON` step missing an id/email — the current implementation's per-step
    validation body is empty (comment: "managed via Leave Policies"). Fix the test or restore
    the validation, but don't trust the test file as ground truth until reconciled.

## Data model / behavioral quirks worth knowing before touching them

19. **`Employee.department` is a free-text string, not a foreign key** to the `Department`
    entity — the two are structurally disconnected (`employees.service.ts` comments this
    explicitly). Deleting/renaming a `Department` row does not touch any `Employee` row.
20. Several controllers' Swagger summaries say "soft-delete" (`departments`, `leave-types`,
    `public-holidays`) but the underlying service call is a **hard** `repo.remove()`. Only
    `Employee` actually soft-deletes (`deletedAt` + `status: ARCHIVED`).
21. Two independent code paths resolve "the active approval workflow" for a leave type:
    `ApprovalWorkflowsService.resolveWorkflow()` (filters by country/leaveType/effective date
    range) vs. the raw join `leave-requests.service.ts` actually uses at submission time
    (filters only by `status = ACTIVE`, ignoring the effective date window). A workflow whose
    `effectiveFrom`/`effectiveTo` window excludes today could still be picked up by
    submission if its `status` happens to be `ACTIVE`.
22. `approveStep()` throws `ForbiddenException` for a "not your turn" mismatch, while the
    structurally identical check in `rejectStep()` throws `ConflictException` — inconsistent
    HTTP status for the same logical error across the two sibling methods.
23. Two migrations share the identical timestamp prefix `1784870000000`
    (`DropCheckWorkflowStepSpecificPerson` and `RemoveEmployeeNumberAndMakePhoneRequired`) —
    their relative execution order depends entirely on the explicit array order in
    `database/data-source.ts`, not on the filename/timestamp.
24. `AppController`/`AppService` are the untouched Nest CLI scaffold — there is no real
    health-check endpoint for uptime/readiness monitoring.

## Build and test health (verified by actually running the suites)

25. **Frontend `npm run build` currently fails** at the `tsc -b` step (~30 errors, mostly
    unused imports/vars, plus a genuine missing-import bug in `LeavePolicies.tsx`). See
    [Testing](13-testing.md#frontend-buildtypecheck-currently-fails). Backend builds clean.
26. **Backend: 2 currently-failing tests**, both in `approval-workflows.service.spec.ts` (see
    item 18 above) — confirmed by running `npm test`, not just static reading. All other 14
    backend spec suites pass (110/112 tests total).
27. **Frontend: 1 currently-failing test**, `admin/pages/EmployeeList.test.tsx` — the
    component calls `useSearchParams()` (to support deep-linking from the Departments page)
    but the test doesn't wrap it in a Router, so it throws `useLocation() may be used only in
    the context of a <Router> component`. Fix the test, not the component.
28. **The `leave-request-submitted` cross-widget refresh event is dispatched inconsistently**:
    fired by request submission, self-cancellation, manual balance adjustment, and HR-override
    approve/reject/delete — but **not** by the normal per-step approve/reject flow used by
    managers on the Approval Dashboard. A manager's ordinary approval doesn't refresh other
    open widgets (balances, dashboard stats, "Who's Out") until the user navigates or manually
    reloads. See [Frontend Architecture](09-frontend-architecture.md#cross-component-refresh-the-leave-request-submitted-window-event).

## Recommended reading order before extending

If you're about to add a new leave-type rule, a new approval step type, or anything touching
"who is allowed to do X," read
[Authentication and Authorization](02-authentication-and-authorization.md) and
[Leave Engine](05-backend-modules-leave-engine.md) first — most surprises live there.
