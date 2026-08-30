# Backend Modules — Organization & People

Covers `employees/`, `departments/`, `divisions/`, `countries/`, `public-holidays/`. Entities
are documented in [Database Schema](03-database-schema-and-migrations.md). **None of these
modules use `AdminGuard` or any role check** — see
[Authentication and Authorization](02-authentication-and-authorization.md).

## Employees (`modules/employees/`)

### Endpoints (base `/v1/employees`)
| Method | Path | Notes |
|---|---|---|
| POST | `/dev-login` | Mock login by email, no password (see auth chapter) |
| POST | `/` | `CreateEmployeeDto` body; optional `x-employee-id` used only as audit actor |
| GET | `/directory` | `{page?,limit?,q?,department?}` → active-employees directory, `DirectoryEmployeeDto[]` |
| GET | `/` | `EmployeeQueryDto` (paginated, filterable by country/division/manager/status/role/policy) |
| GET | `/me` | Requires `x-employee-id`; self profile |
| PATCH | `/me` | Requires `x-employee-id`; arbitrary body but blocks a hardcoded protected-field list (`role,status,employmentType,managerId,countryCode,countryId,department,employeeNumber,divisionId,approvalWorkflowId,policyId,hireDate`) with 403 |
| GET | `/me/leave-balances` | → `LeaveBalancesService.calculateBalancesForEmployee` |
| GET | `/:id` | Get by id |
| GET | `/:id/leave-configuration` | Effective leave-type eligibility (country/waiting-period) |
| PUT | `/:id` | `UpdateEmployeeDto` |
| DELETE | `/:id` | 204, soft-delete (archive) |

### DTOs
`CreateEmployeeDto`: `employeeNumber?`, `fullName`, `email` (`@IsEmail`), `phone?`, `avatar?`,
`jobTitle`, `department` (free text, required), `unit?`, `managerId?` (uuid), `countryCode`
(resolved to a Country by code-or-id server-side), `divisionId?`, `approvalWorkflowId?`,
`policyId?`, `employmentType?`, `workMode?`, `role?`, `hireDate` (`@IsISO8601`), `gender?`,
`emergencyContacts?` (max 5, nested `EmergencyContactDto`).
`UpdateEmployeeDto` = `PartialType(OmitType(CreateEmployeeDto,['policyId']))` + `status?` +
re-declared `policyId?: string | null` (`null` explicitly unassigns the policy).
`EmployeeQueryDto extends PaginationQueryDto` — `sortBy` restricted via `@IsIn` to
`['createdAt','fullName','email','hireDate','status','department','jobTitle']`.

### Service logic beyond CRUD (`employees.service.ts`)
- **Manager validation** (`:62-103`): rejects self-management, rejects an `ARCHIVED`/deleted
  employee as manager, and walks the chain to detect **circular manager assignment**.
- **Country resolution** (`:50-60`): accepts a country `code` or `id`.
- **`create()`** (`:147-263`): normalizes email (lowercase/trim), rejects duplicate active
  email, resolves country + manager + policy (explicit `policyId` or the country's default
  `ACTIVE` `LeavePolicy`, 404 if none). In one transaction: creates the employee, an active
  `EmployeePolicyAssignment`, and one `LeaveBalance` per policy rule — **non-accrued rules
  with `entitlementDays > 0` are front-loaded** (full grant + `INITIAL_GRANT` ledger entry
  immediately); accrual-based rules start at 0. Audit-logs `EMPLOYEE_CREATED`.
- **`update()`** (`:408-603`): re-validates email/manager on change; policy reassignment:
  `policyId === null` closes the active assignment and deletes that year's ledger-less
  balances (kept if ledger history exists, since the FK is `RESTRICT`); switching policies
  closes old + opens new + initializes missing balances without double-granting existing
  ones; auto-resolves the country default if an employee somehow has no active assignment.
  Audit-logs `EMPLOYEE_UPDATED` with old/new diff.
- **`remove()`** (`:607-629`): **nulls all direct reports' `managerId` first** (no cascade
  block), then soft-deletes (`status = ARCHIVED`, `deletedAt = now()`). Audit-logs
  `EMPLOYEE_DELETED`.
- **`devLogin()`** (`:385-404`): see auth chapter.
- **`getLeaveConfiguration()`** (`:633-737`): loads the currently-effective policy assignment
  (errors on 0 or >1 overlapping active assignments); per rule, computes **country
  eligibility** (`rule.allowedCountries` vs. `employee.country.code`) and **waiting period**
  (`rule.waitingPeriodDays` vs. days since `hireDate`).
- `serializeEmployee()` (`:106-143`) is the canonical response shape — flattens
  country/division/manager/workflow to name strings alongside raw FK ids, resolves `policyId`
  from the active assignment.
- **`Employee.department` is a plain string, not a relation** — the directory endpoint
  literally comments `// using name as id since we don't have a department entity`
  (`:362-365`). The `Department` entity (below) is structurally disconnected from `Employee`.

## Departments (`modules/departments/`)

CRUD-only, base `/v1/departments`: `POST /`, `GET /` (paginated, ILIKE name search), `GET /:id`,
`PUT /:id`, `DELETE /:id`. `create()`/`update()` reject duplicate `name`. `remove()` is a
**hard delete** (`departmentRepo.remove()`) despite the controller's Swagger summary saying
"Soft-delete" — and it does **not** check whether any employee references this department (it
couldn't via FK anyway, since `Employee.department` isn't linked to this table).

## Divisions (`modules/divisions/`)

Identical CRUD shape to Departments, base `/v1/divisions`. `remove()` is a hard delete with
**no employee-count guard in application code** — relies purely on the DB FK
`onDelete:'SET NULL'` on `Employee.division`, so deleting an in-use division silently nulls
`divisionId` on its employees rather than being blocked.

## Countries (`modules/countries/`)

Base `/v1/countries`. `create()` rejects if `name` OR `code` already exists; defaults `flag`
to `code` if not supplied. `update()` re-checks name/code uniqueness separately. `remove()`
calls `.remove()`, but the DB-level `onDelete:'RESTRICT'` FKs from `Employee` and
`PublicHoliday` will make the delete fail with a raw FK-violation error (caught generically by
`HttpExceptionFilter` as a 409) if any employee/holiday references it — there's no
friendly pre-check in application code.

## Public Holidays (`modules/public-holidays/`)

Base `/v1/holidays`. `HolidayQueryDto`: `countryId?`, `year?` ("pass year to project recurring
holidays into that year").

Recurrence/date logic lives entirely in the service:
- `projectDateToYear()` rewrites a stored date's year to a target year, keeping month/day —
  this is how `isRecurring: true` holidays "recur": only month/day are meaningful.
- **Duplicate prevention** (`checkDuplicate()`): scoped by `countryId`; recurring uniqueness
  is `countryId + month + day`; non-recurring uniqueness is `countryId + exact date`.
- **`findAll()`**: if `countryId` given, includes holidays where `countryId` matches **or**
  the holiday's country name (case-insensitive) is `'global'` — a "Global" pseudo-country
  applies to every country's calendar. With a `year` filter: non-recurring holidays included
  only if their stored year matches; recurring holidays are projected via
  `projectDateToYear`, and **Feb 29 recurring holidays are skipped on non-leap query years**.
  Without `year`, raw stored rows are returned unprojected.
- `remove()`: hard delete, no usage guard.
- Scoping is **country-only** — no department/division scoping exists.
- `PublicHolidaysModule` exports only `PublicHolidaysService`, not `TypeOrmModule` (unlike
  the other four modules in this chapter), so other modules can't inject the `PublicHoliday`
  repo directly.
