# Leave Request Cancellation — Walkthrough

Implements employee-initiated cancellation of a leave request (PENDING or APPROVED), per `docs/superpowers/plans/2026-08-03-leave-request-cancellation.md`.

## What was already there vs. what changed

The backend already had a `LeaveRequestsService.cancel()` method and a `:id/cancel` controller route (transaction, pessimistic lock, approval-instance skipping, conditional ledger reversal, audit logging) — but it had two real contract bugs and zero test coverage. The frontend Cancel button was 100% fake (local `setState` only, no API call, no confirmation). This work:

1. Fixed the two backend bugs.
2. Added backend test coverage for the cancellation rules.
3. Wired the real cancel flow into `MyInfo.tsx` (confirm dialog, loading state, toast, refresh).
4. Wired the previously-static "Balance History" tab to the real ledger endpoint.
5. Configured Vitest + React Testing Library (none existed) and added frontend tests for the new flow.

## Files modified / created

**Backend**
- `backend/src/modules/leave-requests/leave-requests.service.ts` — rewrote `cancel()`: ownership check now throws `ForbiddenException` (403) instead of silently 404ing; an already-`CANCELLED`/`REJECTED` request now throws `ConflictException` (409) instead of silently no-op'ing (200) — this also *is* the duplicate-refund guard, not a side effect of one. Made the `REVERSAL` ledger `reason` descriptive (e.g. "Cancellation of Annual Leave from 16/07/2026 to 20/07/2026").
- `backend/src/modules/leave-requests/leave-requests.controller.ts` — `:id/cancel` switched from `@Put` to `@Patch`, matching the spec's `PATCH /api/leave-requests/:id/cancel` contract.
- `backend/src/modules/leave-requests/leave-requests.service.spec.ts` — added 9 new tests (ownership, status-gating, idempotency, and real ledger-reversal arithmetic).

**Frontend**
- `vite.config.ts` — added Vitest `test` config (jsdom environment, setup file, `globals: true`).
- `package.json` — added `test`/`test:watch` scripts; added `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` as devDependencies.
- `src/test/setup.ts` (new) — jest-dom matchers + `IS_REACT_ACT_ENVIRONMENT = true` (required for RTL to synchronize with React's scheduler under Vitest; without it, async-effect-driven UI updates aren't reliably observed by `findBy*`/`waitFor`).
- `src/pages/MyInfo.tsx` — real cancel wiring: `PATCH /leave-requests/:id/cancel` call, confirm dialog (reused existing `ConfirmModal`), approved-specific warning copy, per-row disabled state while in flight, toast, dispatches the existing `leave-request-submitted` event on success (already listened to by `WhosOut`, `StatsBar`, `WelcomeBanner`, etc. — this is what refreshes balances/calendar/dashboard for free), Cancel button gated to PENDING/APPROVED only, CANCELLED status shown distinctly with its date. Also wired Balance History to the real `GET /leave-balances/ledger` endpoint (previously 100% static mock data — needed since the spec requires that tab to refresh after cancellation).
- `src/pages/MyInfo.test.tsx` (new) — 7 tests covering the cancel UI flow.

`backend/package.json`/`package-lock.json` also carries an earlier, unrelated fix from this session (`@nestjs/schedule` was imported in code but never installed — added it).

## Business rules covered

| Rule | Where enforced | Where tested |
|---|---|---|
| Only the owner can cancel | `cancel()` — 403 if `employeeId` mismatch | `leave-requests.service.spec.ts` "cannot cancel another employee's request" |
| Cancellable only from PENDING/APPROVED | `cancel()` — 409 otherwise | 4 tests: PENDING ok, APPROVED ok, REJECTED blocked, CANCELLED blocked |
| PENDING cancel doesn't touch the ledger | `cancel()` only calls `applyLedger` if `wasApproved` | "does not touch the ledger" test asserts `applyLedger` not called |
| APPROVED cancel restores the exact days via one REVERSAL | `applyLedger(em, request, REVERSAL, ...)` | real (unmocked) arithmetic test: balance 10 → 15 after reversing 5 days |
| Never refunds twice | Second cancel attempt now throws 409 before reaching `applyLedger` | "repeated cancellation cannot refund twice" — asserts `applyLedger` still called exactly once after 2 attempts |
| Reversal only affects the original leave type | `applyLedger` uses `request.leaveTypeId` throughout | asserted in the "exactly one REVERSAL" test and the arithmetic test |
| Clear ledger description | `` `Cancellation of ${leaveType.label} from ${start} to ${end}` `` | arithmetic test asserts exact string |
| PATCH /leave-requests/:id/cancel, 200/403/404/409 | Controller + service | manual/route-level; covered indirectly via service-level exception-type tests |
| Frontend: Cancel shown only for eligible statuses | `(req.status === 'pending' \|\| req.status === 'approved')` | 4 `MyInfo.test.tsx` tests |
| Confirm dialog, approved-specific copy | `ConfirmModal` + conditional message | "opens a confirmation dialog..." test |
| Disabled while processing, no double submit | `cancellingId` state guard + `disabled` prop | "disables the row action..." test |
| Refresh everywhere (requests, balances, Balance History, dashboard) | reuses existing `leave-request-submitted` event | "refreshes request data after a successful cancellation" test |

## Command output (real, captured during this session)

### Backend

**`npm run test`** (from `backend/`)
```
Test Suites: 1 failed, 8 passed, 9 total
Tests:       1 failed, 56 passed, 57 total
```
The 1 failure is `leave-balances.service.spec.ts` › "should throw BadRequestException if AVAILABLE_BALANCE goes below 0" — expects the substring `"AVAILABLE_BALANCE cannot be negative."` but the service throws `"Cannot deduct: resulting balance would be negative."`. **This file was not touched by this task** and the mismatch pre-dates this change — it's a message-text drift between the test and an already-existing implementation, unrelated to leave-request cancellation.

The `leave-requests` module itself (the code this task actually touched): **23/23 passing** (`npx jest src/modules/leave-requests/`), including the 9 new cancellation tests.

**`npm run test:e2e`**
```
Test Suites: 4 skipped, 0 of 4 total
Tests:       12 skipped, 12 total
```
All e2e suites are skipped in this environment (no live Postgres connection configured per `backend/.env` — pre-existing, unrelated to this change).

**`npm run build`** — succeeds (`nest build`, no output = success).

**`npm run lint`** (`eslint --fix`) — auto-fixed formatting/line-wrapping across touched files, then reported **323 problems (319 errors, 4 warnings)**, all `@typescript-eslint/no-unsafe-*` findings spread across many pre-existing files with heavy `any` usage (a strict lint config that appears to have been failing before this task too — this codebase's `any`-heavy style triggers it everywhere, not specifically in the ~30 lines this task added/changed). None of the specific violations are new categories introduced by this change; fixing 319 pre-existing type-safety lint errors codebase-wide is out of scope for a cancellation feature.

### Frontend

**`npm run test`**
```
Test Files  1 passed (1)
     Tests  7 passed (7)
```
All 7 new `MyInfo.test.tsx` tests pass.

**`npm run build`** (`tsc -b && vite build`) — **fails at the `tsc -b` step**, with 14 errors, all pre-existing and unrelated to this task (confirmed identical before this task began, in files never touched here: `AdminSidebar.tsx`, `BalanceManagement.tsx`, `AdminContext.tsx`, `RequestModal.tsx`, `WhosOut.tsx`, `Layout.tsx`, `ApprovalProgressTimeline.tsx`, `ApprovalDashboard.tsx`, `FullCalendar.tsx` — all `TS6133`/`TS6192` unused-variable/import errors). Running `npx vite build` directly (skipping the pre-existing `tsc -b` failure) **succeeds**, confirming the actual bundle builds fine; the blocker is exclusively the pre-existing strict unused-var typecheck elsewhere in the codebase.

**`npm run lint`** (`oxlint`) — exit code 0, warnings only. One new warning introduced by this task: `MyInfo.tsx:71` "React Hook useEffect has a missing dependency: 'balances'" — this is an intentional run-once-on-mount effect that reads `balances` from closure only as a fallback default; adding it to the dependency array would make the effect re-subscribe its event listener on every balance update, which is not the intended behavior. Left as-is.

**`npx tsc --noEmit`** — same 14 pre-existing errors as `tsc -b` above (exit code 2). No errors in `MyInfo.tsx`, `MyInfo.test.tsx`, `vite.config.ts`, or `src/test/setup.ts`.

## Remaining untested areas / limitations

- **HTTP-level status codes (403/404/409) are not covered by an e2e/HTTP test** — they're verified at the service-exception-type level (`ForbiddenException`/`NotFoundException`/`ConflictException`) in the unit suite, which is what Nest translates to those HTTP codes, but no e2e test hits the running `PATCH /leave-requests/:id/cancel` route over HTTP (the e2e suite is entirely skipped in this environment — no live DB).
- **Balance History ledger→leave-type-code mapping** resolves codes client-side from the employee's *current active* balances list. If a ledger entry references a leave type no longer in the employee's active policy, it falls back to displaying the raw UUID instead of a label. Pre-existing risk in how this data is shaped, newly exposed now that the tab is live instead of static mock data.
- **319 backend lint errors and 14 frontend build/typecheck errors are pre-existing** and were not introduced or fixed by this task — flagged above with exact locations; fixing them is a separate, much larger cleanup effort outside this feature's scope.
- **`leave-balances.service.spec.ts`'s 1 pre-existing failing test** (message text mismatch) was not touched, per the same reasoning.

---

# Admin Balance Management — Transaction Ledger Fix (2026-08-04)

Fixes the HR Admin "Leave Balances" page (`/admin/balances`) showing `Invalid Date`, `—` (Leave Type / Reason), and `NaN` (Balance After) in the Transaction Ledger table, for every row.

## Root cause

`GET /leave-balances/ledger` (`LeaveBalancesService.findAllLedger`) was, at some earlier point, reshaped to return the same "clean DTO" as the dedicated Accrual History endpoint (`GET /leave-ledger/history`) — the service comment literally reads *"Shape into clean DTO for Accrual History frontend"*. Its rows now use `createdAt` / `leaveTypeName` / `description` / `balanceAfter`, not the raw `LeaveLedgerEntry` entity fields (`transactionDate` / `leaveType.label` / `reason` / `resultingBalance`) that `BalanceManagement.tsx` and its `getLedgerEntries()` wrapper were still typed and coded against. The `Change` and `Type` columns happened to keep working because `signedAmount` and `transactionType` are named identically in both shapes — only `Date`, `Leave Type`, `Reason`, and `Balance After` broke, matching exactly what was reported.

Confirmed via direct backend calls (`curl .../leave-balances/ledger` vs `curl .../leave-ledger/history`) that both endpoints now return the identical row shape — so the fix is on the frontend contract, not the backend (which several other, working pages already depend on in its current shape).

A second, independent bug was found and fixed in the same file while verifying in the browser: `BalanceManagement.tsx` auto-selects `state.employees[0]` as soon as the list is non-empty, but `AdminContext`'s `state.employees` is seeded synchronously with legacy mock data (numeric ids like `1`) before the real backend employee list (UUID ids) loads asynchronously. On every fresh page load this fired `GET /leave-balances/employee/1` and `GET /leave-balances/ledger?employeeId=1`, both returning `400 Bad Request — uuid is expected`.

## Files modified

- `src/services/balancesApi.ts` — `getLedgerEntries()` return type changed from the stale `BackendLedgerEntry[]` to `AccrualHistoryRow[]` (already defined in the same file for the Accrual History page), matching what `GET /leave-balances/ledger` actually returns. Added a comment on the function documenting the real field names, since the old field names look plausible but are wrong. `BackendLedgerEntry` itself is left in place — it's still the correct shape for `adjustBalance()`'s response (`POST /leave-balances/adjust` returns the raw saved entity, not the DTO).
- `src/admin/pages/BalanceManagement.tsx`:
  - Removed the stale local `LedgerEntry` interface; `ledgerData` is now typed `AccrualHistoryRow[]`.
  - Ledger table now renders `l.createdAt` (Date), `l.leaveTypeName` (Leave Type), `l.description` (Reason), `l.balanceAfter` (Balance After).
  - The Leave Type filter dropdown matched against `l.leaveType?.key`, a field that doesn't exist on the real response (always `undefined`, so the filter silently matched nothing once a specific type was picked). Now resolves the selected leave type's `leaveTypeId` from the already-loaded balances list and filters `l.leaveTypeId` against it.
  - Fixed the mock-data auto-select race: only auto-selects `state.employees[0]` once its `id` is a string (real backend UUID), not the numeric mock seed.
  - Added a `leave-request-submitted` window-event listener (the same refresh signal already used by `WhosOut`, `StatsBar`, `WelcomeBanner`, etc.) so this page's balances and ledger refetch automatically when a leave request is submitted/cancelled/approved/rejected anywhere else in the app, not just when this page's own "Adjust Balance" action runs.
  - `handleAdjust` now also dispatches `leave-request-submitted` after a successful adjustment, so other open widgets pick up the balance change too.
- `src/admin/pages/LeaveRequests.tsx` — `handleApprove`/`handleReject` (HR override approve/reject, which create `USAGE` ledger entries) now dispatch `leave-request-submitted` on success. Previously this admin action didn't notify anything, so Balance Management (or any other page relying on that signal) never learned a balance-affecting change had happened elsewhere.

No backend files changed — the API contract itself is correct and shared correctly with the Accrual History page; only the stale frontend consumer needed updating.

## Validation results (real, captured during this session)

- **Root cause confirmed via direct API calls**: `curl http://localhost:3000/api/v1/leave-balances/ledger?employeeId=<uuid>&year=2026` against the real dev Postgres data returned `createdAt`/`leaveTypeName`/`description`/`balanceAfter` fields, not the old raw shape — verified before writing any fix.
- **Verified live in the browser (Playwright) against real Postgres data**, HR Admin session, `/admin/balances`:
  - Selected "Salim Hizi" (4 `INITIAL_GRANT` rows) — Date, Type, Leave Type, Reason, Change, Balance After all correct (e.g. `22/07/2026 · initial grant · Sick Leave · Initial frontloaded policy grant · +10 · 10`).
  - Selected "salim 11" (mixed `REVERSAL`/`USAGE` rows, including negative/overdrafted balances) — all columns correct, including negative Balance After values rendering as real numbers, not `NaN` (e.g. `04/08/2026 · reversal · Annual Leave · Cancellation of Annual Leave from 20/12/2026 to 22/12/2026 · +3 · -68`).
  - Leave Type filter dropdown set to "Sick Leave" correctly narrowed the table to only that employee's Sick Leave row.
  - Confirmed the auto-select bug: before the fix, a fresh page load logged two `400 Bad Request` console errors (`.../leave-balances/employee/1`, `.../leave-balances/ledger?...employeeId=1`) before any employee was manually clicked. After the fix, a fresh page load produces zero console errors.
- **`npx tsc -b`**: 14 errors, identical count and file list to the pre-existing baseline (`AdminSidebar.tsx`, `BalanceManagement.tsx`'s 3 pre-existing unused-var errors — `dispatch`, `accrualRunning`, `setAccrualRunning`, none touched by this fix — `AdminContext.tsx`, `RequestModal.tsx`, `WhosOut.tsx`, `Layout.tsx`, `ApprovalProgressTimeline.tsx`, `ApprovalDashboard.tsx`, `FullCalendar.tsx`). No new type errors introduced.
- **`npm run lint`** (oxlint) — exit code 0. All output is pre-existing warnings (unused imports/vars, `react-hooks/exhaustive-deps`) across files this task didn't touch, plus the 3 pre-existing warnings already in `BalanceManagement.tsx` (`dispatch`, `accrualRunning`, `setAccrualRunning`) and the pre-existing empty-destructure warning in `LeaveRequests.tsx` (`const {} = useAdmin();`, line 23, not introduced by this change). No new warnings from the edited lines.

## Not done / out of scope this round

- `BalanceManagement.tsx`'s 3 pre-existing unused-variable errors (`dispatch`, `accrualRunning`, `setAccrualRunning`) were left as-is — they predate this fix and are unrelated to the ledger contract bug.
- The employee-side (non-HR-override) `approve`/`reject` step actions (`PUT /leave-requests/:id/approve|reject`, used by managers/HR in the normal per-step workflow, as opposed to the HR-override `PUT /leave-requests/hr/:id/approve|reject` used on the admin Leave Requests page) do not dispatch `leave-request-submitted`. Only the HR-override path was in scope here since that's the action reachable from the admin side that most directly affects the page just fixed; wiring every approval entry point is a larger, separate change.
