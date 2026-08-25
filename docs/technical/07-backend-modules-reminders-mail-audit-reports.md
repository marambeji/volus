# Backend Modules — Reminders, Mail, Audit Logs, Reports

## Leave Reminders (`modules/leave-reminders/`)

Base `/v1/reminders`, **entire controller guarded by `AdminGuard`**.

| Method | Path | Notes |
|---|---|---|
| GET | `/settings` | `ReminderSettings` (singleton, lazily created with `enabled:true, delayHours:48` on first read) |
| PUT | `/settings` | `UpdateReminderSettingsDto {enabled?, delayHours? (1–720)}`, actor from `x-employee-id` |
| GET | `/history?limit=` | `LeaveReminderNotification[]`, newest first |
| POST | `/run` | Manually triggers `runReminderCheck()` |

`runReminderCheck()` (`leave-reminders.service.ts:66-123`):
1. Short-circuits `{checked:0, sent:0}` if `settings.enabled === false`.
2. `cutoff = now - delayHours` hours.
3. Finds `ApprovalInstance` rows `status=PENDING` whose parent `LeaveRequest.status=PENDING`
   and `ai.updatedAt <= cutoff` — using `updatedAt` not `createdAt` deliberately, since every
   step row is bulk-created upfront (steps 2+ start `WAITING`) and only gets its `updatedAt`
   bumped when it actually transitions to `PENDING`.
4. For each instance, resolves approvers (`HR` steps fan out to every active `HR_ADMIN`) and
   skips any `(instance, approver)` pair already present in `LeaveReminderNotification`
   (unique-indexed) — no duplicate reminders.
5. Sends via `MailService.sendMail()`; only records a notification row if it actually
   returned `true`.

`LeaveRemindersSchedulerService` (`leave-reminders-scheduler.service.ts:17`) calls this exact
same method on `@Cron(CronExpression.EVERY_HOUR, {timeZone:'UTC'})` — the manual `POST /run`
and the automatic hourly cron share 100% of the logic, no divergence.

## Mail (`modules/mail/`)

`MailService` uses `nodemailer.createTransport` — SMTP only, no other provider/SDK. Env vars:
`MAIL_HOST`, `MAIL_PORT` (default 587), `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` (falls back to
`MAIL_USER`, then hardcoded `'no-reply@volus.app'`). `secure: port === 465` — no other
explicit TLS mode handling.

**Dev/unconfigured fallback**: if `host`/`user`/`pass` is missing, `transporter` is set to
`null` at construction with a `Logger.warn` — emails are **silently skipped**, not logged to
console as a substitute.

`sendMail(to, subject, html): Promise<boolean>` — **never throws**. Returns `false` if
unconfigured or if nodemailer throws (caught + logged); returns `true` only on confirmed send.
Every caller must check the boolean return rather than relying on try/catch.

No controller in this module — `MailService` is only ever injected by other modules
(currently just `leave-reminders`).

## Audit Logs (`modules/audit-logs/`)

`@Global()` module — `AuditLogsService` is injectable anywhere without importing the module.

**Logging is manual, not automatic** — no interceptor/decorator/subscriber exists; every
entry is an explicit `.log(...)` call scattered through business logic:
- `leave-requests.service.ts` — 12 call sites (submit/approve/reject/cancel/HR-delete,
  per-step approve/reject/skip, ledger usage/reversal).
- `employees.service.ts` — 3 call sites (create/update/delete).
- `approval-workflows.service.ts` — 3 call sites (create/update/delete).

`log(actorId, actionType, entityType, entityId, details, em?)` (`:296-371`): resolves
actor name/role from the `Employee` repo (validates `actorId` is a real UUID first, else
`actorName='System'`/`actorRole='SYSTEM'`), diffs `oldValues`/`newValues` into
`changedFields`, builds a human `description` via `buildAuditDescription()`, **sanitizes**
`oldValues`/`newValues` to redact `password`/`token`/`secret`/`document`/`avatar` keys, and
optionally writes inside a passed `EntityManager` for transactional consistency with the
triggering change.

`BALANCE_ADJUSTED` and `POLICY_ASSIGNED` are handled in `buildAuditDescription()`'s switch but
have **zero** `.log(...)` call sites anywhere in the backend — dead enum branches.

### Endpoints (base `/v1/audit-logs`)
| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/my-notifications` | header only | `findMyNotifications(employeeId)` — filtered to a **hardcoded whitelist** `NOTIFIABLE_ACTION_TYPES` (the 5 `LEAVE_REQUEST_*` types only, deliberately excluding `APPROVAL_STEP_*`); matches rows where `newValues->>'employeeId' = employeeId` OR the employee appears as a `resolvedApproverId` inside `newValues->'approvalInstances'`; capped at 30 rows |
| GET | `/history?entityType=&entityId=` | header only | `getHistory()` — simple filtered `find`, no ownership check server-side |
| GET | `/global?entityType=&actionType=` | **`AdminGuard`** | `findAll()` — the HR-only global feed; no pagination, no date-range filter |

## Reports (`modules/reports/`)

Base `/v1/reports`, all three endpoints take `x-employee-id` (actor) + a loose
`@Query() query: any` — **no DTO/validation pipe**, matches an untyped `ReportsQuery`
interface (`dateFrom?, dateTo?, employeeId?, managerId?, department?, country?, leaveTypeId?,
status?, year?`, all strings).

### Role-based scoping — `applyRequestScope()` (`reports.service.ts:79-98`)
- `EMPLOYEE` → forced to own `employeeId`, ignores other filters.
- `MANAGER` → forced to `emp.managerId = actor.id` (direct reports only).
- `HR_ADMIN` → unscoped by default; `query.managerId` optionally narrows to one team.

### `GET /reports/requests` (`:48-77`)
Joins employee→country, leaveType. Filters (`applyRequestFilters`, `:100-133`): exact
employeeId/department/leaveTypeId/status, country by name, and a date-range **overlap** check
(`endDate >= dateFrom && startDate <= dateTo`) rather than strict containment. Ordered
`startDate DESC`.

### `GET /reports/balances` (`:137-215`)
Only `ACTIVE`, non-deleted employees. Per matching employee, calls
`leaveBalancesService.calculateBalancesForEmployee(id, year)`; **if that throws** (e.g. no
active policy assignment), the row is **not dropped** — caught and returned zeroed
(`balances:{}`, `totalAvailable:0`). No `leaveTypeId`/`status`/date filters apply here.

### `GET /reports/overlaps` (`:219-299`)
Blocks `EMPLOYEE` role (`ForbiddenException`). Defaults to the current calendar year if no
date range given. Only `APPROVED` requests, ordered `startDate ASC`.

**Clustering algorithm** (`:244-268`, "interval-graph connected components"): single sweep —
maintain `current`/`currentEnd`; a request joins the current cluster if
`req.startDate <= currentEnd` (string comparison on ISO dates), extending `currentEnd` if its
`endDate` is later; otherwise the cluster closes and a new one starts. A closed cluster is
kept only if it has **2+ requests** — this is **transitive chain grouping** (A–B–C grouped if
A overlaps B and B overlaps C, even if A and C don't directly overlap), not strict pairwise
mutual overlap.

`dailyCounts` (`:283-293`): for every day in `[dateFrom, dateTo]`, counts how many (unclustered,
full) requests span that day; only days with `count > 0` included.
`peakConcurrent` = max of `dailyCounts[].count`.
`totalOverlapDays` = count of days where `count >= 2`.

Response: `{ clusters, dailyCounts, peakConcurrent, totalOverlapDays }`.

`ReportsModule` imports `LeaveBalancesModule` only — never writes audit logs.
