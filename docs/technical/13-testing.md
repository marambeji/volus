# Testing

## Backend (Jest, via `@nestjs/testing`)

```bash
cd backend
npm test            # jest
npm run test:watch  # jest --watch
npm run test:cov    # jest --coverage
npm run test:e2e    # jest --config ./test/jest-e2e.json (separate e2e project config;
                     # skipped entirely in an environment with no live Postgres connection)
```

No coverage thresholds are enforced — `test:cov` reports coverage but does not fail the run
below any percentage.

### Current state (verified by running the suite)

```
Test Suites: 1 failed, 15 passed, 16 total
Tests:       2 failed, 110 passed, 112 total
```

Every module has at least one spec file:
```
src/app.controller.spec.ts
src/modules/approval-workflows/approval-workflows.service.spec.ts   ← the 1 failing suite
src/modules/audit-logs/audit-logs.service.spec.ts
src/modules/countries/countries.service.spec.ts
src/modules/divisions/divisions.service.spec.ts
src/modules/employees/employees.service.spec.ts
src/modules/leave-balances/leave-balances.service.spec.ts
src/modules/leave-reminders/leave-reminders.service.spec.ts
src/modules/leave-requests/leave-requests.controller.spec.ts
src/modules/leave-requests/leave-requests.service.spec.ts
src/modules/leave-types/leave-types.controller.spec.ts
src/modules/leave-types/leave-types.service.spec.ts
src/modules/mail/mail.service.spec.ts
src/modules/policies/policies.service.spec.ts
src/modules/public-holidays/public-holidays.service.spec.ts
src/modules/reports/reports.service.spec.ts
```
`departments/` and `divisions`/`countries`' **controllers** (as opposed to their services) and
`approval-workflows`' controller have no dedicated spec file — everything else does.

**The 2 failing tests** are both in `approval-workflows.service.spec.ts`, both expecting
`validateSteps()` to throw `BadRequestException` for a `SPECIFIC_PERSON` step missing an
id/email, or a non-`SPECIFIC_PERSON` step that has one set. The current implementation's
per-step validation body is empty (see
[Leave Engine](05-backend-modules-leave-engine.md#approval-workflow-engine-approval-workflows)) —
this is a real, currently-failing, pre-existing test/code mismatch, not a flaky test. Either
restore the validation or update the tests to match current behavior.

## Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm test           # vitest run (single run)
npm run test:watch # vitest (watch mode)
npm run coverage    # vitest run --coverage (v8 provider)
```

Config lives inside `frontend/vite.config.ts`'s `test` block (no separate
`vitest.config.ts`):
```
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
}
```
No coverage thresholds configured. `src/test/setup.ts` imports
`@testing-library/jest-dom/vitest` and sets `IS_REACT_ACT_ENVIRONMENT = true`. No MSW or other
mock-server setup — API calls are mocked per-test.

### Current state (verified by running the suite)

```
Test Files  1 failed | 8 passed (9)
     Tests  1 failed | 21 passed (22)
```

Test files: `pages/ApprovalDashboard.test.tsx`, `pages/LeaveTracking.test.tsx`,
`pages/Login.test.tsx`, `pages/MyInfo.test.tsx`, `pages/Reports.test.tsx`,
`admin/pages/AdminDashboard.test.tsx`, `admin/pages/EmployeeList.test.tsx`,
`admin/pages/NotificationManager.test.tsx`, `admin/pages/PublicHolidays.test.tsx`.

**The 1 failing test** is `admin/pages/EmployeeList.test.tsx › renders employee directory
list`: `useLocation() may be used only in the context of a <Router> component`. The component
now calls `useSearchParams()` (added to support the "click a department → pre-filtered
employee list" deep-link, see
[Frontend Architecture](09-frontend-architecture.md)), which requires a Router context the
test doesn't provide. Fix by wrapping the render in a `<MemoryRouter>` in the test, not by
changing the component.

### Known coverage gaps
No tests found for: `Home.tsx`, `People.tsx`, `FullCalendar.tsx`, `Notifications.tsx`, any
`components/dashboard/*`, `components/layout/*`, `components/reports/*`, `components/ui/*`,
any `services/*.ts` or `services/mappers/*`, `hooks/useNotificationReadState.ts`, or any admin
page beyond the four listed above (including `LeaveRequests.tsx`, `BalanceManagement.tsx`,
`LeavePolicies.tsx`, `ApprovalLevels.tsx`, `Countries.tsx`, `Departments.tsx`, `Reports.tsx`,
`AuditLog.tsx`).

## Frontend build/typecheck currently fails

`npm run build` (`tsc -b && vite build`) currently **fails at the `tsc -b` step** with ~30
errors, almost all `TS6133` (unused import/variable) across many files (e.g.
`ApprovalLevels.tsx`, `BalanceManagement.tsx`, `Countries.tsx`, `WhosOut.tsx`,
`PdfReportDocument.tsx`) plus a couple of real type errors
(`services/mappers/workflowMapper.ts:152-153`, `string | null` not assignable to
`string | undefined`). One of the `tsc -b` errors is a genuine bug, not just lint noise:
**`admin/pages/LeavePolicies.tsx:101` — `Cannot find name 'CountryItem'`** (a missing type
import). Running `npx vite build` directly (skipping the `tsc -b` typecheck step) succeeds,
and `npm run dev` is unaffected — but the documented `npm run build` command will not
currently produce a build on its own. The backend (`npx tsc --noEmit`) has no such issues and
builds cleanly.
