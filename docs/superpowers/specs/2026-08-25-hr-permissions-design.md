# HR Permissions — Design Spec

Date: 2026-08-25

## Problem

Today every employee with `role = HR_ADMIN` has identical, unrestricted access
to the whole admin portal (`AdminGuard` only checks `role === 'HR_ADMIN'`).
There is exactly one seeded HR admin (`admin@novelus.com`), but nothing stops
anyone from creating more HR_ADMIN accounts via the Employees page (see the
"hr salim 1" account already created in this environment), and every one of
them gets full power.

We need a way for one designated "main" HR Admin to restrict what other HR
Admin users can see and do, module by module (Employees, Leave Requests,
Leave Balances, Accrual History, Leave Policies, Countries, Public Holidays,
Approval Levels, Notification Manager, Reports, Audit Log, Notifications).

## Decisions locked in during brainstorming

- **Default access**: full access. A missing permission row for a module
  means the user can view and manage it. The Super Admin's job is to dial
  access *down* for specific users, not to build access up from zero. This
  avoids silently locking out any HR_ADMIN account that already exists.
- **Granularity**: two independent booleans per module — `canView` (see the
  page/data) and `canManage` (create/edit/delete/approve/etc.). A user can be
  read-only on one module and full-control on another.
- **Who is the Super Admin**: a boolean flag `isSuperAdmin` on `Employee`,
  not a new role value. `role` stays `HR_ADMIN` for everyone in HR; the flag
  is the only thing that distinguishes the main admin. This keeps every
  existing `role === 'HR_ADMIN'` check in the codebase valid unchanged.
  Only the seeded `admin@novelus.com` gets `isSuperAdmin = true`. Promoting a
  second Super Admin is possible in principle (the flag isn't a singleton)
  but there is no UI for it — out of scope (YAGNI).
- **Scope of backend enforcement**: enforcing this feature for real requires
  putting `AdminGuard` on controllers that don't have it today (`employees`,
  `policies`, `countries`, `holidays`, `departments`, `approval-workflows`,
  `reports`, `leave-balances`). That's a pre-existing gap, not something this
  feature invents, but closing it is required for the new permission checks
  to mean anything on those routes. Approved as part of this work.

## Data model

### `employees` table

Add one column:

```
is_super_admin boolean NOT NULL DEFAULT false
```

Seed data update: set `is_super_admin = true` for `admin@novelus.com`.

### New table `hr_permissions`

| column       | type      | notes                                    |
|--------------|-----------|-------------------------------------------|
| id           | uuid PK   |                                            |
| employee_id  | uuid FK   | → employees(id), ON DELETE CASCADE        |
| module       | varchar   | one of the `HrModule` keys below          |
| can_view     | boolean   | default true                              |
| can_manage   | boolean   | default true                              |
| created_at   | timestamp |                                            |
| updated_at   | timestamp |                                            |

Unique constraint on `(employee_id, module)`.

**Semantics**: a row's absence for `(employee, module)` means full access
(`canView: true, canManage: true`). When the Super Admin saves a permission
set for a user, the backend replaces that user's entire row set with exactly
what was submitted (delete-then-insert or upsert-then-delete-missing) — so a
saved record is always a complete, unambiguous statement of that user's
access, never a partial override layered on a default.

A Super Admin's own effective permissions are always full access on every
module, computed in code (`isSuperAdmin ? allTrue : lookupRows`) — no rows
are ever written for a Super Admin, and the API rejects attempts to set
permissions on a Super Admin target.

### Module registry

A single source of truth, e.g. `backend/src/common/constants/hr-modules.ts`:

```ts
export const HR_MODULES = [
  'employees', 'departments',
  'leaveRequests', 'leaveBalances', 'accrualHistory', 'leavePolicies',
  'countries', 'publicHolidays', 'approvalLevels', 'notificationManager',
  'reports', 'auditLog', 'notifications',
] as const;
export type HrModule = typeof HR_MODULES[number];
```

Mirrored on the frontend as the same literal list (or generated from one
shared JSON if the repo already shares types between front/back — otherwise
duplicated, since front and back are separate TypeScript projects here).
Dashboard and the HR Permissions page itself are not in this list; they are
always accessible (Dashboard to any HR_ADMIN, HR Permissions only to a Super
Admin, gated separately by `isSuperAdmin`).

## Backend

### Entities

- `Employee`: add `isSuperAdmin: boolean`.
- New `HrPermission` entity mapping the table above, `ManyToOne` to
  `Employee`.

### Guards

- `SuperAdminGuard` (new, `common/guards/super-admin.guard.ts`): same
  `x-employee-id` header lookup as `AdminGuard`, additionally requires
  `employee.isSuperAdmin === true`. Used to protect the `hr-permissions`
  controller itself.
- `PermissionGuard` (new, `common/guards/permission.guard.ts`): reads
  `request.user` (already attached by a preceding `AdminGuard` on the same
  route) and metadata set by a `@RequireModule(module, level)` decorator
  (`common/decorators/require-module.decorator.ts`, `level` is `'view'` or
  `'manage'`). Looks up effective permission via `HrPermissionsService`,
  throws `ForbiddenException` if not satisfied. A Super Admin always passes.
  Runs after `AdminGuard` so `request.user` is populated:
  `@UseGuards(AdminGuard, PermissionGuard)`.

### `hr-permissions` module

- `HrPermissionsService`:
  - `getEffectivePermissions(employeeId): Record<HrModule, {canView, canManage}>`
  - `listHrAdmins(): { id, fullName, email, isSuperAdmin, permissions }[]` —
    for the picker on the new page (all employees with `role = HR_ADMIN`).
  - `setPermissions(employeeId, entries: {module, canView, canManage}[])` —
    validates `employeeId` is an `HR_ADMIN` and not a Super Admin, validates
    every `module` is a known `HrModule`, replaces the row set.
- `HrPermissionsController` (`@Controller('hr-permissions')`,
  `@UseGuards(SuperAdminGuard)`):
  - `GET /hr-permissions` → `listHrAdmins()`
  - `GET /hr-permissions/:employeeId` → `getEffectivePermissions()`
  - `PUT /hr-permissions/:employeeId` → `setPermissions()`

### Retrofitting existing controllers

Add `AdminGuard` (where missing) + `PermissionGuard` + `@RequireModule(...)`
to the routes that map to a module:

| Controller | Module | view routes | manage routes |
|---|---|---|---|
| `employees.controller.ts` | `employees` | GET list/:id | POST/PATCH/DELETE |
| `leave-requests.controller.ts` (`hr/*` routes only) | `leaveRequests` | `GET hr` | `PUT hr/:id/approve|reject|delete` |
| `leave-balances.controller.ts` | `leaveBalances` | GET routes | mutating routes |
| `policies.controller.ts` | `leavePolicies` | GET routes | mutating routes |
| `countries.controller.ts` | `countries` | GET routes | mutating routes |
| `public-holidays.controller.ts` | `publicHolidays` | GET routes | mutating routes |
| `departments.controller.ts` | `departments` | GET routes | mutating routes |
| `approval-workflows.controller.ts` | `approvalLevels` | GET routes | mutating routes |
| `reports.controller.ts` | `reports` | GET routes | — (read-only resource) |
| `leave-reminders.controller.ts` | `notificationManager` | GET routes | mutating routes |
| `audit-logs.controller.ts` | `auditLog` | GET routes | — (read-only resource) |

Non-admin employee-facing routes (self-service endpoints like
`my-requests`, `whos-out`, `calendar`) are untouched — this feature only
governs the HR admin portal.

`accrualHistory` and `notifications` (admin analytics page) currently have
no dedicated backend resource in this codebase (accrual history reads off
`leave-ledger`/`leave-balances`; the admin Notifications page's data source
needs a quick check during implementation — if it's mock/local data with no
real endpoint, enforcement for those two modules is frontend-only, which is
consistent with there being no backend data to protect).

### Employee `dev-login` response

Extend the payload with:
```ts
{ ...existing, isSuperAdmin: boolean, permissions: Record<HrModule, {canView, canManage}> }
```
so the frontend has everything it needs in `currentUser` without an extra
round trip after login.

## Frontend

### Session shape

`currentUser` (localStorage) gains `isSuperAdmin: boolean` and
`permissions: Record<HrModule, {canView, canManage}>`.

### Sidebar (`AdminSidebar.tsx`)

Each nav item is tagged with its `HrModule` key (Dashboard and Settings stay
untagged/always-visible). Filter items whose `canView` is false. Add a new
"HR Permissions" item under CONFIGURATION, rendered only when
`currentUser.isSuperAdmin`.

### Route guarding (`AdminApp.tsx`)

Wrap each `<Route>` (except Dashboard/Settings) with a check against
`currentUser.permissions[module].canView`; redirect to `/admin/dashboard`
if false. The HR Permissions route checks `currentUser.isSuperAdmin`
instead.

### Per-page action gating

Existing pages (`EmployeeList.tsx`, `LeaveRequests.tsx`, etc.) hide/disable
Add/Edit/Delete/Approve controls when `currentUser.permissions[module].canManage`
is false, while still rendering the read-only list/detail view. This is a
small, mechanical change per page (wrap existing buttons in the existing
conditional-render pattern already used for things like the unread badge).

### New page: `HRPermissions.tsx`

Route `/admin/hr-permissions`, under Configuration. Structure mirrors
`ApprovalLevels.tsx`: a searchable list of HR Admin users on the left
(from `GET /hr-permissions`), each showing name/email and a "Super Admin"
badge where applicable (not selectable — Super Admins aren't editable
targets). Selecting a user opens a `SlideDrawer` with a table: one row per
`HrModule` (human-readable label), two checkboxes (View / Manage). Save
calls `PUT /hr-permissions/:employeeId` with the full set, matching the
NOVELUS violet/slate styling already used across `SlideDrawer`-based config
pages.

New API wrapper `frontend/src/services/hrPermissionsApi.ts` following the
existing `approvalWorkflowsApi.ts` pattern (thin functions over `apiFetch`).

## Testing

Backend (Jest, following existing `*.spec.ts` conventions):
- `hr-permissions.service.spec.ts`: default-full-access when no rows exist,
  upsert-replace semantics on save, Super Admin always fully permitted,
  rejects setting permissions on a Super Admin or non-HR_ADMIN target.
- `super-admin.guard.spec.ts` / `permission.guard.spec.ts`: allow/deny cases
  mirroring the existing `admin.guard` test style (check if one exists,
  otherwise pattern off `leave-requests.controller.spec.ts`'s guard usage).

Frontend (Vitest/RTL, following existing `*.test.tsx` conventions):
- `AdminSidebar.test.tsx` (or extend if it exists): nav items hidden when
  `canView` is false; HR Permissions item hidden for non-Super-Admins.
- `HRPermissions.test.tsx`: loads the HR admin list, saves a permission
  change, calls the API with the expected payload.

## Out of scope

- Promoting/demoting Super Admin status via UI.
- Permission changes affecting anything outside the HR admin portal
  (manager/employee self-service views are untouched).
- Real authentication (this app's `x-employee-id` header + `dev-login` model
  is unchanged; this feature builds on top of it, not a replacement for it).
