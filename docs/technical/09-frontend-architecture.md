# Frontend Architecture

React 19 + TypeScript + Vite 8 SPA, `react-router-dom` 7, Tailwind CSS 4, Recharts for
charts. Entry: `frontend/src/main.tsx` mounts `<App/>` in `<StrictMode>`.

## Session and routing (`frontend/src/App.tsx`)

- Reads `localStorage.getItem('currentUser')` into `{id, name, email, role, avatar}`
  (`App.tsx:26`). A migration guard force-logs-out if `id` is numeric or <20 chars (old
  mock-ID format) (`:29-33`).
- Three mutually-exclusive routing blocks, chosen by `currentUser`:
  1. **Unauthenticated** — only `/login` renders, `*` → redirect to `/login`.
  2. **`role === 'admin'`** — mounts `<AdminApp onLogout/>` at `/admin/*`; `*` → redirect to
     `/admin/dashboard`. Admins cannot reach any employee/manager route.
  3. **Everything else (`manager`/`employee`)** — wrapped in the shared `<Layout>`, with an
     inline role check gating `/employee/approval-dashboard` to `role === 'manager'` only
     (`:88-95`) — this is the **only** in-router role guard in the whole app; there's no
     reusable `<ProtectedRoute>` component.
- `Login.tsx` is shared by all three roles — the same form, differentiated only by which
  account is entered. Client-side password check is a hardcoded literal `'admin'`
  (`Login.tsx:27-30`); real "authentication" is the backend's `dev-login` lookup (see
  [Authentication and Authorization](02-authentication-and-authorization.md)).

## Two structurally separate portals

### Admin portal (`frontend/src/admin/`)
`AdminApp.tsx` wraps everything in `<AdminProvider>` (legacy context, see below) then
`<AdminLayout>`, and owns its own sub-routes: `/dashboard`, `/employees`, `/leaves`,
`/balances`, `/accrual-history`, `/policies`, `/approval-levels`, `/countries`, `/holidays`,
`/departments`, `/reports`, `/audit`, `/notifications`, `/reminders`, `/settings`; `/` and
unknown paths redirect to `/admin/dashboard`.

| Page | Route | Purpose (see [business docs](../business/README.md) for user-facing behavior) |
|---|---|---|
| `AdminDashboard.tsx` | `/dashboard` | Read-only KPI/chart overview |
| `EmployeeList.tsx` | `/employees` | Employee CRUD |
| `LeaveRequests.tsx` | `/leaves` | HR-wide request approve/reject/delete |
| `BalanceManagement.tsx` | `/balances` | Balance view + manual adjust |
| `AccrualHistory.tsx` | `/accrual-history` | Read-only ledger browser |
| `LeavePolicies.tsx` | `/policies` | Policy + per-type quota + workflow config |
| `ApprovalLevels.tsx` | `/approval-levels` | Approval workflow config |
| `Countries.tsx` | `/countries` | Country CRUD |
| `PublicHolidays.tsx` | `/holidays` | Holiday CRUD |
| `Departments.tsx` | `/departments` | Department CRUD |
| `Reports.tsx` | `/reports` | Company-wide analytics |
| `AuditLog.tsx` | `/audit` | Global audit feed |
| `Notifications.tsx` | `/notifications` | HR's own notification feed |
| `NotificationManager.tsx` | `/reminders` | Reminder settings |
| `Settings.tsx` | `/settings` | **Static placeholder — no handlers, no data, stub for future work** |

**Layout**: `AdminHeader.tsx` + `AdminSidebar.tsx` + `AdminLayout.tsx` (thin composer, only
owns local `mobileOpen` state). Both header and sidebar consume the shared
`admin/utils/useAdminUnreadCount.ts` hook for the notification-bell badge count (fetches
`getGlobalAuditLogs()`, cross-references `localStorage['notif_read_ids']`, syncs on
`notif_read_updated`/`storage` events) — this is the single source of truth for that count.

**`admin/store/AdminContext.tsx` — mostly legacy.** The reducer manages `employees`,
`leaveRequests`, `leaveBalances`, `leaveLedger`, `policies`, `holidays`, `auditLog`,
`notifications`, `approvalLevels`. Only `employees` (and partially `policies`/
`leaveBalances`) are hydrated from the real backend on mount and actually consumed by pages
(`EmployeeList.tsx`, `AdminDashboard.tsx`, `BalanceManagement.tsx`, `Departments.tsx`).
**`leaveRequests`, `leaveLedger`, `holidays`, `auditLog`, `notifications`, `approvalLevels`
are still seeded from `admin/data/adminMockData.ts` and never overwritten** — every page that
deals with those concepts fetches its own live data directly from `services/*Api.ts` instead
and ignores the context for them. The reducer's full mock-CRUD action handlers for those
slices (`APPROVE_REQUEST`, `ADD_POLICY`, etc.) are dead code in practice. Only
`CANONICAL_DEPARTMENT_NAMES` from `adminMockData.ts` is meaningfully still live (used by
`EmployeeList.tsx`, `LeavePolicies.tsx`, `Reports.tsx`). Treat `AdminContext`/
`adminMockData.ts` as a holdover from a pre-backend-integration version of the app — new work
should call `services/*Api.ts` directly, not extend this context.

`admin/components/ui/PolicyDetailsModal.tsx` appears unused (`LeavePolicies.tsx` implements
its own inline view mode) — likely dead code.

### Employee/Manager portal (`frontend/src/pages/` + shared `components/`)

Routes (all under the shared `<Layout>`):

| Page | Route | Role-adaptive? |
|---|---|---|
| `Home.tsx` | `/employee/dashboard` | Same for both, composed of self-fetching widgets |
| `MyInfo.tsx` | `/employee/my-info` | Same |
| `LeaveTracking.tsx` | `/employee/leave-tracking` | Same |
| `ApprovalDashboard.tsx` | `/employee/approval-dashboard` | **Manager-only**, route-guarded in `App.tsx` |
| `People.tsx` | `/employee/people` | Same |
| `Reports.tsx` | `/employee/reports` | **Fully branched inside one file** — renders `ManagerReports` or `EmployeeReports` based on `currentUser.role` |
| `Notifications.tsx` | `/employee/notifications` | Same |
| `FullCalendar.tsx` | `/employee/full-calendar` (+ `/full-calendar` redirect) | Same |

`Navbar.tsx` hides the "Approval Dashboard" link for non-managers (`:39-44`) — cosmetic only,
the real gate is the `App.tsx` route check.

`Layout.tsx` composes `Navbar` (sidebar) + a header (dark-mode toggle, `NotificationDropdown`,
user info, logout) + a globally-mounted `Chatbot`.

`components/ui/Chatbot.tsx` calls the Google Gemini API **directly from the browser**
(`generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`) using
an API key from `VITE_GEMINI_API_KEY` or `localStorage`, grounding answers in static HR
documents from `data/knowledgeBase.ts`.

`hooks/useNotificationReadState.ts` is the employee/manager-side read-tracking hook —
localStorage key `my_read_notification_ids`, custom event `notif_read_ids_updated` — a
**separate mechanism with a separate key** from the admin side's `notif_read_ids`/
`notif_read_updated`. Used by `pages/Notifications.tsx` and
`components/layout/NotificationDropdown.tsx`.

## Component inventory (non-admin)

- `components/dashboard/` — `WelcomeBanner`, `StatsBar`, `WhosOut`, `LatestRequestCard`,
  `UpcomingHolidays`, `CompanyLinks`, `RequestModal` (the leave-submission form),
  `ApprovalProgressSection`, `EmployeeCard`. `ApprovalProgressSection.tsx` looks like an
  earlier version of what `LeaveTracking.tsx` now does — not wired into `Home.tsx`.
- `components/layout/` — `Layout`, `Navbar`, `NotificationDropdown`.
- `components/reports/` — shared between the employee/manager `Reports.tsx` and the admin
  `Reports.tsx`: `BalancesTable`, `RequestsTable`, `OverlapsPanel`, `ReportFilterBar`,
  `reportCharts.tsx` (Recharts wrappers), `NovelusPdfReport` + `PdfReportDocument`.
- `components/ui/` — `ApprovalProgressTimeline`, `Avatar`, `Badge`, `Chatbot`, `EmptyState`,
  `LoadingSpinner`, `Pagination` (the one shared `Pagination` — admin pages import this one
  too, not a separate admin copy).

## Cross-component refresh: the `leave-request-submitted` window event

There is no shared query cache/state library (no React Query, no Redux beyond the legacy
`AdminContext`) — instead, any screen that changes leave data broadcasts a plain
`window.dispatchEvent(new Event('leave-request-submitted'))`, and any widget that displays
leave-derived data listens for it and refetches.

**Dispatchers**: `components/dashboard/RequestModal.tsx` (new submission),
`pages/MyInfo.tsx` (self-cancellation), `admin/pages/BalanceManagement.tsx` (manual
adjustment), `admin/pages/LeaveRequests.tsx` (HR-override approve/reject/delete).

**Listeners**: `components/dashboard/WhosOut.tsx`, `StatsBar.tsx`, `WelcomeBanner.tsx`,
`LatestRequestCard.tsx`, `ApprovalProgressSection.tsx`, `pages/LeaveTracking.tsx`,
`admin/pages/BalanceManagement.tsx` (also a listener, to pick up changes made elsewhere).

**Gap**: the *normal* per-step approve/reject flow — `pages/ApprovalDashboard.tsx`'s
manager-facing Approve/Reject buttons, calling `PUT /leave-requests/:id/approve|reject`
directly — does **not** dispatch this event. Only the HR-override path
(`PUT /leave-requests/hr/:id/approve|reject`) does. This means a manager approving a request
through the normal Approval Dashboard does not trigger other open tabs/widgets (balances,
"Who's Out," the dashboard stats bar) to refresh — they'll show stale data until the user
navigates or manually refreshes. See
[Known Issues](14-known-issues-and-technical-debt.md).

## Static/mock data still in the tree

`frontend/src/data/mockData.ts` — still a live fallback in a few places (`MyInfo.tsx` initial
state, `UpcomingHolidays.tsx` fallback, `CompanyLinks.tsx`'s only data source since there's no
backend endpoint for company links) but otherwise superseded by real API calls.
`data/knowledgeBase.ts` feeds the Chatbot. `data/countriesList.ts` (`WORLD_COUNTRIES`) is used
only by the **admin** `Countries.tsx`/`CountryDropdownSelect.tsx`, not by any non-admin page.
