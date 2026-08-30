# Backend Modules — Balances & Policies

Covers `leave-types/`, `policies/`, `leave-balances/`. Entities in
[Database Schema](03-database-schema-and-migrations.md). **No guards on any endpoint in these
three modules.**

## Leave Types (`modules/leave-types/`)

Plain CRUD, base `/v1/leave-types`. `key`-uniqueness enforced on create/update. `remove()` is
a **hard delete** (`repo.remove()`) despite the controller's "Soft-delete" Swagger summary —
`LeaveType` has no `deletedAt` column.

## Policies (`modules/policies/`)

- One `LeavePolicy` per country (`policy.country`, eager). `divisions` (ManyToMany, eager) is
  a descriptive/filter tag only — **does not affect which employees get the policy**.
- Entitlement is per `(policy, leaveType)` via `LeaveRule` — different countries can freely
  have different entitlements for the same `LeaveType` since each has its own `LeavePolicy`.
- **Attachment to employee**, two paths, both via `EmployeePolicyAssignment`:
  1. Explicit `CreateEmployeeDto.policyId`.
  2. Fallback: `policyRepo.findOne({ where: { country: { id: country.id } } })` — the
     country's (first/only) policy. **No department/division-based default path exists.**
  - `PoliciesService.create()` also **backfills** a newly-activated policy onto any of that
    country's employees who don't yet have an active assignment
    (`assignPolicyToUnassignedEmployees`, `:323-348`).
- `calculateBalancesForEmployee()`/`runAccruals()` require **exactly one** active assignment
  (`effectiveFrom <= today <= effectiveTo`); 0 or >1 active assignments silently short-circuit
  (empty balances / skipped) rather than throwing.
- Create/update are transactional and atomic across `LeavePolicy`+`LeaveRule`+
  `SeniorityMilestone`. Update does an **in-place merge by `leaveTypeId`** rather than
  delete/recreate, specifically to avoid breaking the `RESTRICT` FK from
  `LeaveBalance.leavePolicyRuleId` on every ordinary edit (`:472-480` comment).
- `remove()` (`:553-580`) is the **one path that destroys balance/ledger data**: explicitly
  deletes the policy's rules' `LeaveBalance` rows and their `LeaveLedgerEntry` rows before
  removing the policy — everywhere else the FK is `RESTRICT`.

### Endpoints (base `/v1/policies`)
`POST /`, `GET /` (pagination + search + country/division/leaveType/status filters),
`GET /:id`, `PUT /:id`, `DELETE /:id` (labeled soft-delete, actually cascading hard-delete —
see above).

## Leave Balances / Ledger (`modules/leave-balances/`)

### Read path — `calculateBalancesForEmployee()` (`leave-balances.service.ts:50-208`)
Computed live from the ledger, not purely from the stored `availableBalance`/`usedYtd`
columns:
- Sums ledger entries by type: `openingBalance` (INITIAL_GRANT), `accruedAmount` (ACCRUAL),
  `carriedOverAmount` (CARRY_OVER — always 0 in practice, nothing ever writes this type),
  `manualAdjustments` (MANUAL_ADJUSTMENT), `approvedUsed` (USAGE abs sum, minus REVERSAL abs
  sum).
- `pendingAmount` = live sum of the employee's `PENDING` `LeaveRequest.durationDays` for that
  type — not read from `LeaveBalance.pending` (that column is never written).
- `USAGE_YTD` types: `available = max(0, entitlementDays - approvedUsed)`.
- `AVAILABLE_BALANCE` types: `available = openingBalance + accruedAmount + carriedOverAmount + manualAdjustments - approvedUsed`.
- Response includes both semantic and legacy-alias field names for frontend compatibility.

### Accrual — `AccrualSchedulerService` + `runAccruals()` (`leave-balances.service.ts:511-626`)
`@Cron('0 6 1 * *', UTC)` — 1st of every month, 06:00 UTC. For each active employee with
exactly one active assignment, for each `LeaveRule` with `isAccrued && accrualRate` set and
`leaveType.isActive`:
- Fires if `accrualInterval === MONTHLY` (every run) or `YEARLY` **and** the run month is
  January.
- Idempotency key `ACCRUAL:{employeeId}:{leaveTypeId}:{year}-{month}` dedups against existing
  ledger rows.
- `newBalance = min(current + rate, maxBalanceCap)` if capped, else `current + rate` — capped,
  not compounded, not tenure-prorated.
- Writes an `ACCRUAL` ledger entry, `signedAmount = resultingBalance - current`.
- **`SeniorityMilestone` tiers are never consulted here** — confirmed dead for calculation.
- Non-accrued rules with `entitlementDays > 0` are front-loaded once at employee creation
  (`INITIAL_GRANT`, in `employees.service.ts`), not accrued incrementally.
- **No manual "run accrual now" endpoint exists** — only the cron triggers it.

### Manual adjustment — `adjust()` (`leave-balances.service.ts:376-507`)
`POST /leave-balances/adjust`, `AdjustBalanceDto` (`employeeId`/`leaveTypeId` uuid, `year`
2000–2100, `amount` non-zero max 2 decimals, `reason` 3–500 chars, optional
`idempotencyKey`). Creates the `LeaveBalance` row on the fly if missing; **rejects if it
would drive `usedYtd`/`availableBalance` negative**; dedups via idempotency
key/fingerprint (`ConflictException` on mismatched-payload reuse).
**`LeaveBalancesController.adjust()` calls `service.adjust(dto)` with no second argument**, so
`performedByEmployeeId` is always `null` for adjustments made through this HTTP endpoint,
even though the service signature accepts a performer id. No `AuditActionType.BALANCE_ADJUSTED`
call site exists anywhere — the ledger row itself is the only audit trail for adjustments.

### Debit/credit writers (both live in `leave-requests.service.ts`, not this module)
- **Usage**: `applyLedger(..., USAGE, actorId)` on final approval (see
  [Leave Engine](05-backend-modules-leave-engine.md)).
- **Reversal**: same helper with `REVERSAL`, fired only as a side effect of cancelling or
  HR-deleting an already-`APPROVED` request — **there is no standalone "reverse balance"
  admin endpoint**.
- All debit/credit/adjustment paths use `dataSource.transaction()` with a `pessimistic_write`
  lock on the `LeaveBalance` row to prevent concurrent double-spend.

### Endpoints
| Method | Path | Notes |
|---|---|---|
| GET | `/leave-balances/ledger` | Filterable ledger query — **response is reshaped into the same "clean DTO" as `/leave-ledger/history`** (`createdAt`, `leaveTypeName`, `description`, `balanceAfter`, plus `signedAmount`/`transactionType` which happen to share names with the raw entity), not the raw `LeaveLedgerEntry` field names (`transactionDate`/`leaveType.label`/`reason`/`resultingBalance`). A frontend consumer typed against the raw entity shape will silently get `undefined`/`NaN` for the renamed fields — this exact bug happened once already in `BalanceManagement.tsx` (fixed; see `walkthrough.md` at the repo root for the incident writeup) |
| GET | `/leave-balances/employee/:employeeId` | Computed balances, optional `?year=` |
| POST | `/leave-balances/adjust` | Manual adjustment |
| GET | `/leave-balances` | Paginated raw `LeaveBalance` rows |
| GET | `/leave-balances/:id` | One `LeaveBalance` row |
| GET | `/leave-ledger/history` | Flattened "Accrual History" admin table (separate controller, `leave-ledger.controller.ts`) |

## Carry-over / expiry / gender — confirmed dead or absent

Grep-confirmed: **no code anywhere writes a `CARRY_OVER` or `RESET` ledger entry** — the only
scheduled job in the backend is the monthly accrual cron; carry-over/reset `LeaveRule` config
is stored but never enforced. **No gender field exists on `LeaveType`/`LeavePolicy`/
`LeaveRule`** — `Gender` lives only on `Employee`, is never read by these three modules, and
has zero effect on eligibility anywhere in the backend.
