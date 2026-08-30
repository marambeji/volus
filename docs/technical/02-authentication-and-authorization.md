# Authentication and Authorization

> **This is a prototype-grade identity system, not production auth.** Read this chapter
> fully before extending anything that touches "who is the current user."

## There is no real authentication

Confirmed by exhaustive search of the backend:
- No `passport`, `jwt`, or `bcrypt` package is even a dependency (`backend/package.json`).
- `Employee` has no password field, anywhere (no column in any migration, no field on the
  entity).
- No `/auth/*` routes, no cookie/session middleware, nothing in `main.ts`/`app.module.ts`
  resembling an auth layer.

## Login flow (frontend + backend)

1. **Frontend** — `frontend/src/pages/Login.tsx`: the only client-side check is a **hardcoded
   literal password `'admin'`** (`Login.tsx:27-30`) — any typed value beyond that literal is
   never actually verified against anything. On submit, it `POST`s `{ email }` (no password)
   to the backend.
2. **Backend** — `POST /api/v1/employees/dev-login`
   (`employees.controller.ts:33-38`, `@ApiOperation({summary:'Mock login endpoint for development'})`)
   → `EmployeesService.devLogin(email)` (`employees.service.ts:385-404`):
   - Looks up an `Employee` purely by (lowercased/trimmed) email — **no credential of any
     kind is checked**.
   - 404 if no employee with that email; 400 if the employee's `status !== ACTIVE`.
   - Returns `{ id, name, email, role, avatar }` with `role` mapped to a simplified
     `'admin' | 'manager' | 'employee'` string (`HR_ADMIN`→`admin`, `MANAGER`→`manager`, else
     `employee`).
3. **Frontend** stores that response object verbatim as `localStorage['currentUser']`
   (`App.tsx` `handleLogin`) and never contacts a token/refresh endpoint — the session simply
   *is* whatever's in `localStorage`.

## "Current user" on every other request

Every protected/self-scoped backend endpoint reads a raw header, `x-employee-id`, via
`@Headers('x-employee-id')` (40+ occurrences across
`employees.controller.ts`, `leave-requests.controller.ts`, `approval-workflows.controller.ts`,
`audit-logs.controller.ts`, `reports.controller.ts`, `leave-reminders.controller.ts`).
`frontend/src/services/apiClient.ts` sets this header on every request from
`localStorage.currentUser.id`.

**The header value is trusted at face value.** There is no signature, no server-issued
token, nothing proving the caller actually is that employee — any client can set
`x-employee-id` to any UUID that exists in the `employees` table (including an HR_ADMIN's)
and the API will act as that person. Missing the header on a route that requires it throws
`UnauthorizedException('Missing x-employee-id header')` (e.g.
`employees.controller.ts:63-65`, `leave-requests.controller.ts:29`).

## Role-based authorization: `AdminGuard`

`common/guards/admin.guard.ts` is the **only** guard in the codebase (`admin.guard.ts:6-32`):

```
1. Read x-employee-id header → 401 if absent.
2. DataSource.getRepository(Employee).findOne({ where: { id: employeeId } }) → 401 if not found.
3. employee.role !== 'HR_ADMIN' → 403 ForbiddenException.
4. Attach the found employee to request.user.
```

It performs **authorization only** (role check), never authentication — it trusts the same
self-reported header the rest of the app trusts. There is no `@Roles()` decorator or generic
`RolesGuard`; `AdminGuard` is hardcoded to the single `HR_ADMIN` check. No guard exists for
`MANAGER`-only behavior — manager-scoped logic (e.g. `getCalendarData`, the reports
role-scoping in `reports.service.ts:79-98`) is implemented inline in service methods by
comparing the resolved employee's role/relationships, not via a decorator.

### Where `AdminGuard` is actually applied

| Scope | Location |
|---|---|
| Whole controller | `leave-reminders.controller.ts:9` — `RemindersController` (settings, history, run) |
| Method | `audit-logs.controller.ts:38` — `GET /audit-logs/global` |
| Method | `leave-requests.controller.ts:76,86,97,109` — `GET /leave-requests/hr`, `PUT hr/:id/approve`, `PUT hr/:id/reject`, `PUT hr/:id/delete` |

Everything else — including all of `employees`, `departments`, `divisions`, `countries`,
`public-holidays`, `leave-types`, `policies`, `leave-balances` (including the manual-adjust
endpoint), and **all of `approval-workflows`'s create/update/delete endpoints** — has **no
guard at all**. Any endpoint without `AdminGuard` only checks that `x-employee-id` is
present/non-empty where the controller bothers to check it; it does not verify the caller's
role. See [Known Issues](14-known-issues-and-technical-debt.md) for why this matters most for
`approval-workflows` (the "Approval Levels" HR feature).

## Frontend route gating

`frontend/src/App.tsx:25-105` is the only place routes are gated, purely client-side:
- No `currentUser` in `localStorage` → only `/login` renders.
- `currentUser.role === 'admin'` → mounts `<AdminApp/>` at `/admin/*`; nothing else is
  reachable.
- Otherwise → the shared employee/manager `Layout` + routes; `/employee/approval-dashboard`
  is wrapped in an inline check (`App.tsx:88-95`) that redirects away unless
  `role === 'manager'`.
- `Navbar.tsx:39-44` additionally hides the "Approval Dashboard" nav link for non-managers —
  this is cosmetic only; the real gate is the route check above.

There is no `<ProtectedRoute>` abstraction — each gate is an inline conditional. None of this
is enforced server-side beyond `AdminGuard`'s HR-only checks — a non-admin who directly calls
an admin-only backend endpoint without `AdminGuard` protection would succeed.

## Practical implication for future work

Any new endpoint that should be restricted to HR must explicitly add `@UseGuards(AdminGuard)`
— it is not inherited from anywhere. Any new "is this really you" requirement (e.g. real
login) would need to replace the entire `x-employee-id` header scheme end-to-end (frontend
`apiClient.ts`, every controller's header reads, and `AdminGuard`), not just bolt on top of
it.
