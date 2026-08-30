# Role-Based Leave Reports — Design

Date: 2026-08-05
Status: Approved (brainstorming phase) — ready for implementation planning

## 1. Problem

`src/admin/pages/Reports.tsx` exists but is 100% backed by mock data
(`AdminContext` → `src/admin/data/adminMockData.ts`) — no `apiFetch` calls
anywhere in the file. There is no reporting view at all for Managers or
Employees, and no backend module that aggregates leave data for reporting.

Mira (HR) needs three role-scoped views:

- **Admin**: company-wide — all employees, all leave requests, most-used
  periods, absences by country/team/department, overlapping leave.
- **Manager**: same shape, scoped to direct reports only (e.g. "who on my
  team is on leave, when, how many days each, are multiple people out at
  once, do any requests overlap").
- **Employee**: personal only — days used, % of annual leave consumed,
  when leave was taken, % taken in summer, date-range filtered request
  history (e.g. "all of Ryan's requests between June and August" — from a
  manager/admin's perspective when drilling into one person).

## 2. Scope decisions (from brainstorming)

- **Real backend, not frontend-computed.** A new NestJS module enforces
  role scope server-side, so a Manager can't see another team's data even
  by manipulating query params from devtools.
- **Team = direct reports only** (`employee.managerId === manager.id`),
  matching the one existing manager-resolution pattern in
  `leave-requests.service.ts:127-145` (no recursive hierarchy today).
- **Overlaps = `APPROVED` requests only.** Pending requests aren't a real
  absence yet.
- **"Summer" = June–August inclusive**, for the "% taken in summer" stat.
- **Export CSV available to all three roles**, scoped to whatever the
  viewer is currently looking at (same client-side CSV mechanism already
  in `Reports.tsx:108-153`, reused unchanged).
- **New page for Manager/Employee** (`src/pages/Reports.tsx`, added to the
  employee/manager sidebar), rather than bolting stats onto `MyInfo.tsx`
  or `ApprovalDashboard.tsx` — keeps each existing page's purpose intact.
- **Visual analytics required**: KPI tiles + charts (bar, line, pie,
  histogram) on top of the existing table-based UI, using **recharts**
  (already a dependency, already used in `AdminDashboard.tsx:7` for
  Pie/Bar/Area charts — no new library).
- **Keep current UI/UX**: charts and KPI tiles are added *into* the
  existing card/table/drawer visual language, not a redesign.

## 3. Backend

New module: `backend/src/modules/reports/` (`reports.module.ts`,
`reports.controller.ts`, `reports.service.ts`), following the existing
per-module convention (controller/service/dto split, no entities of its
own — it reads existing `Employee`, `LeaveRequest`, `LeaveBalance`
repositories).

Every endpoint reads `x-employee-id` (same header-based pattern used
everywhere else, e.g. `leave-requests.controller.ts:26,47,55,88`), looks up
that employee's **real** role from the DB, and scopes automatically:

| Caller role | Scope applied |
|---|---|
| `HR_ADMIN` | no restriction (whole company) |
| `MANAGER`  | forced `managerId = caller.id` (direct reports), regardless of any filter the client sends |
| `EMPLOYEE` | forced `employeeId = caller.id` |

### Endpoints

- **`GET /reports/requests`** — list of leave requests. Filters:
  `dateFrom`, `dateTo`, `employeeId`, `managerId` (admin only — filter to
  one manager's team), `department`, `country`, `leaveTypeId`, `status`.
  Built on the same query-builder shape as
  `leave-requests.service.ts#hrFindAll` (`leave-requests.service.ts:672-711`),
  extended with a `managerId` join-filter that doesn't exist there today.
  For an `EMPLOYEE` caller this is scope-equivalent to the existing
  `GET /leave-requests/my-requests` — implemented by delegating to the
  same underlying query rather than duplicating logic.

- **`GET /reports/balances`** — one row per employee in scope, with
  per-leave-type balance figures. For each employee in scope, calls
  `LeaveBalancesService.calculateBalancesForEmployee`
  (`leave-balances.service.ts:49-194`) — the existing, correct
  entitlement/used/available logic — rather than re-deriving totals.
  *Known ceiling*: this loops per employee (N calls into the existing
  per-employee calculator) rather than one bulk SQL query; fine at this
  app's employee-count scale, would need a real bulk query if the company
  grows into the thousands.

- **`GET /reports/overlaps`** — `403 Forbidden` for `EMPLOYEE` callers
  (overlap has no meaning for a single person). For Admin/Manager: loads
  `APPROVED` requests in scope, sweep-line groups them into clusters of
  ≥2 requests whose `[startDate, endDate]` ranges intersect, returns each
  cluster (participating employees + overlapping date span) plus a
  per-day concurrent-absence count (feeds the histogram).

Employee personal stats (% annual used, % used in summer, days used) need
**no new endpoint** — computed client-side from
`GET /employees/me/leave-balances` (already used in `MyInfo.tsx:41-95`)
and `GET /leave-requests/my-requests`, both already correctly scoped and
already the source of truth for the underlying numbers.

### Backend tests

`reports.service.spec.ts` (Jest, colocated, per project convention):
- Admin caller → sees all employees/requests.
- Manager caller → sees only direct reports, even when a wider filter is
  requested.
- Employee caller → sees only their own requests.
- Overlap detection → 3 mutually-overlapping approved requests cluster
  together; a 4th non-overlapping one doesn't; a `PENDING` request in the
  same window is excluded.
- `GET /reports/overlaps` as `EMPLOYEE` → 403.
- Date-range filter on `/reports/requests` is inclusive/correct at
  boundaries.

## 4. Frontend

### Shared components — `src/components/reports/`

Used identically by Admin and Manager views (backend already scopes the
data, so the same components/API calls work for both):
- `ReportFilterBar` — configurable filter row (date range via the two
  native `<input type="date">` already introduced in
  `src/pages/LeaveTracking.tsx`, employee search via the existing
  `SearchInput`, and `SelectFilter` dropdowns for manager/department/
  country/leave type — shown/hidden per role and per tab).
- `KpiTiles` — small stat-card row (per dataviz skill's "stat tile"
  pattern), content varies per tab (see §5).
- `BalancesTable`, `RequestsTable`, `OverlapsPanel` — table/list views,
  role-agnostic.
- Chart wrappers (recharts, styled like `AdminDashboard.tsx`):
  `MonthlyUsageBarChart`, `BreakdownChart` (pie/bar by country or
  department), `OverlapHistogram`, `PersonalUsagePieChart`.

### `src/services/reportsApi.ts`

Thin wrappers over the 3 endpoints, following the existing `*Api.ts` +
`apiFetch` pattern (`src/services/employeesApi.ts` as the template).

### Pages

- **`src/admin/pages/Reports.tsx`** — rewired from `AdminContext` mock to
  `reportsApi`. Tabs: Balances / Requests / Overlaps / Countries /
  Departments (the last two already exist as tabs today; they become
  `BreakdownChart` + table over real `/reports/requests` data grouped
  client-side by country/department — grouping already-authorized rows is
  fine, it's balance *totals* specifically that must come from the
  backend calculator).
- **`src/pages/Reports.tsx`** (new, added to the employee/manager sidebar
  nav, visible for both roles like `ApprovalDashboard` is manager-only
  today) — branches on `currentUser.role`:
  - `MANAGER` → same shared components as Admin, team-scoped.
  - `EMPLOYEE` → `KpiTiles` (% annual used, days used, % used in summer)
    + `PersonalUsagePieChart` + `MonthlyUsageBarChart` (highlights
    summer months) + a date-range/leave-type filtered request list.

### KPI tiles per tab

| Tab | KPIs |
|---|---|
| Requests | Total / Approved / Rejected / Pending |
| Balances | Total days used / employees in scope / average utilization % |
| Overlaps | Peak concurrent absences / total overlapping days |
| Employee personal | % annual leave used / days used / % used in summer |

### Frontend tests

None added — no test runner is configured for the frontend anywhere in
this project (per `CLAUDE.md`), consistent with existing convention.
Verified manually via the dev server (golden path per role + edge cases:
empty state, no overlaps, employee with 0 requests) before considering
the feature done.

## 5. Out of scope (this iteration)

- Recursive manager hierarchies (indirect reports) — flagged as a
  possible future extension, not needed for the current ask.
- PENDING requests in overlap detection.
- Bulk/optimized SQL for `/reports/balances` at large scale (see ceiling
  note in §3) — current per-employee loop is adequate for this
  application's scale.
