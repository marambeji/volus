# Frontend Services & API Integration

All backend communication goes through `frontend/src/services/`. Nothing calls `fetch`
directly outside this folder except a few admin pages that use the exported `apiFetch` helper
directly for one-off endpoints not yet wrapped (e.g. `apiFetch('/leave-requests/whos-out')` in
`EmployeeList.tsx`, `apiFetch('/audit-logs/global')` in `admin/pages/AuditLog.tsx`).

## `apiClient.ts` — the shared HTTP layer

- Base URL: `import.meta.env.VITE_API_URL`, falling back to `http://localhost:3000/api/v1`
  (trailing slash stripped).
- **Auth**: reads `localStorage.currentUser`, sends its `id` as header `x-employee-id` on
  every request — no bearer token. See
  [Authentication and Authorization](02-authentication-and-authorization.md).
- `apiFetch<T>(endpoint, options)`: generic wrapper. `204` → `undefined`. Non-OK response →
  throws `ApiError`.
- `ApiError extends Error` — `status`, `validationMessages: string[]` (backend's array
  `message` from `ValidationPipe`/`HttpExceptionFilter` joined into `.message`, but kept as an
  array in `validationMessages` for field-level display), `details: unknown`. A network-level
  fetch failure is wrapped as `ApiError(0, 'Server unreachable: ...')`. An `AbortError` is
  re-thrown as-is (not wrapped), so callers using `AbortController` for cleanup can still
  `catch` and check `err.name === 'AbortError'`.
- `PaginatedResponse<T>` / `PaginatedMeta` types defined here and reused by most list services.

## Service files (one per backend resource)

| File | Backend resource | Key exports |
|---|---|---|
| `employeesApi.ts` | `/employees`, `/leave-requests` (self-service) | `getEmployees`, `createEmployee`, `updateEmployee`, `deleteEmployee`, `getLeaveConfiguration`, `getMyLeaveBalances`, `submitLeaveRequest`, `getApprovalProgress`, `getMyLeaveRequests`, `getDirectory` |
| `balancesApi.ts` | `/leave-balances`, `/leave-ledger` | `getBalances`, `getEmployeeBalances`, `adjustBalance`, `getLedgerEntries`, `getLedgerHistory` |
| `countriesApi.ts` | `/countries` | `getCountries`, `createCountry`, `updateCountry`, `deleteCountry` |
| `departmentsApi.ts` | `/departments` | `getDepartments`, `createDepartment`, `updateDepartment`, `deleteDepartment` |
| `divisionsApi.ts` | `/divisions` | `getDivisions` (read-only, no mutations exposed) |
| `holidaysApi.ts` | `/holidays` | `getHolidays`, `createHoliday`, `updateHoliday`, `deleteHoliday` (all mapped through `mappers/holidayMapper.ts`) |
| `leaveTypesApi.ts` | `/leave-types` | `getLeaveTypes` — **filters out any `key`/`label` starting with `e2e`** (test-data leak protection) |
| `policiesApi.ts` | `/policies` | `getPolicies` (list, then N+1 fetches each `getPolicyById` for full detail), `getPolicyById`, `createPolicy`, `updatePolicy`, `deletePolicy` |
| `remindersApi.ts` | `/reminders` | `getReminderSettings`, `updateReminderSettings`, `getReminderHistory`, `runReminderCheckNow` |
| `reportsApi.ts` | `/reports` | `getRequestsReport`, `getBalancesReport`, `getOverlapsReport` |
| `approvalWorkflowsApi.ts` | `/approval-workflows` | full CRUD |
| `auditLogsApi.ts` | `/audit-logs` | `getGlobalAuditLogs`, `getMyNotifications` |
| `adminApi.ts` | `/leave-requests/hr*` | `hrGetLeaveRequests`, `hrApproveLeaveRequest`, `hrRejectLeaveRequest`, `hrDeleteLeaveRequest` — despite the filename, this is used by the **manager/HR flows outside `src/admin`** too (e.g. `ApprovalDashboard.tsx` uses the plain `/leave-requests/:id/approve` path via `apiFetch` directly, not this file — check call sites before assuming which path a given screen uses) |

## Mappers (`services/mappers/`)

Backend DTO shape ↔ frontend UI shape, isolating the two from drifting into each other:
- `employeeMapper.ts` — `toAdminEmployee()` / `toBackendEmployeePayload()`. Note:
  `toBackendEmployeePayload()` **always sends `policyId`**, even when unset, specifically so
  the backend can distinguish "explicitly cleared" from "field not touched" (see
  `UpdateEmployeeDto.policyId` accepting `null`, in
  [Org & People modules](04-backend-modules-org-and-people.md)).
- `holidayMapper.ts` — form ↔ `{name, date, countryId, isRecurring}`; resolves a nested
  country name client-side if the API response didn't include it.
- `policyMapper.ts` — the largest mapper: UI `LeaveQuota` ↔ `BackendLeaveRuleDto` (accrual
  interval/rate parsing, cut-off date splitting into month/day, carry-over/overdraft flags,
  seniority milestones) and full policy response ↔ `CountryPolicy`.
- `workflowMapper.ts` — approver-type enum translation (`manager↔MANAGER`,
  `manager_manager↔MANAGERS_MANAGER`, `specific_employee↔SPECIFIC_PERSON`, `hr↔HR`) and full
  workflow DTO ↔ `ApprovalConfiguration` translation.

## Error handling pattern

Pages generally: `try { await someApiCall() } catch (err) { const msg = err instanceof
ApiError ? err.validationMessages.join(' | ') || err.message : 'fallback message'; setError(msg) }`
— consistent across admin and non-admin pages (e.g. `NotificationManager.tsx`, `LeavePolicies.tsx`).
`AbortController`-based cleanup on unmount is a common pattern for list-loading `useEffect`s
(check `err.name === 'AbortError'` and return early without setting error state).
