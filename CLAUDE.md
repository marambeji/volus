# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is two separate Node projects in one repo, each with its own `package.json` and dependency tree:

- **Root (`/`)** — React 19 + TypeScript + Vite frontend ("hr-leave-portal"). Serves both the employee/manager UI and the HR Admin UI from the same app.
- **`backend/`** — NestJS 11 + TypeORM + PostgreSQL API. Run all backend commands from inside `backend/`.

There is no top-level script that runs both together — start each dev server separately (see below).

## Commands

### Frontend (run from repo root)
```
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview   # preview production build
```
No frontend test suite exists yet (no test runner configured, no `*.spec.ts`/`*.test.ts` files under `src/`).

### Backend (run from `backend/`)
```
npm run start:dev      # nest start --watch, http://localhost:3000
npm run start:fresh     # kills anything on :3000 first, then start:dev
npm run build           # nest build
npm run lint            # eslint --fix
npm run test            # jest (unit specs, *.spec.ts colocated with source)
npm run test:watch
npm run test:cov
npm run test:e2e        # jest -c test/jest-e2e.json
```
Run a single backend test file directly with jest, e.g.:
```
npx jest src/modules/leave-requests/leave-requests.service.spec.ts
```

### Database (run from `backend/`)
```
npm run migration:generate   # typeorm migration:generate -d src/database/data-source.ts
npm run migration:run
npm run migration:revert
npm run migration:show
npm run seed                  # ts-node src/database/seeds/seed.ts
```
`synchronize` is hard-disabled in `data-source.ts` — schema changes must go through a migration.

**Windows gotcha:** `data-source.ts` imports every migration file explicitly instead of glob-scanning the `migrations/` folder, because a glob pattern breaks on the literal apostrophe in this repo's parent directory name (`stage d'été`). When adding a new migration, you must also add an explicit `import` for it in `backend/src/database/data-source.ts`.

Copy `backend/.env.example` to `backend/.env` before running the backend; it documents `DATABASE_URL` vs. discrete `DB_*` vars and the `DB_SSL`/`DB_SSL_REJECT_UNAUTHORIZED` combinations for local Postgres vs. a managed/Supabase Postgres.

## Architecture

### Auth is dev-only, not production auth
There is no JWT/session auth despite what a diagram might suggest. Login (`POST /employees/dev-login`) just looks up an employee by email and returns it; the frontend stores the full user object (including role) in `localStorage.currentUser` and re-sends the employee's id on every request via the `x-employee-id` header (`src/services/apiClient.ts`). The backend's `AdminGuard` (`backend/src/common/guards/admin.guard.ts`) trusts this header directly — it looks up the `Employee` by that id and checks `role === 'HR_ADMIN'`. Don't try to "fix" this into real auth unless asked; it's the intended current state of the project.

### Role-based routing (frontend)
Three roles: `HR_ADMIN` (frontend session role `admin`), `MANAGER`, `EMPLOYEE`. `src/App.tsx` branches the entire router by `currentUser.role`:
- `admin` → mounted entirely under `AdminApp` at `/admin/*` (`src/admin/`), everything else redirects there.
- `manager`/`employee` → shared `Layout` + routes under `/employee/*` (`src/pages/`). `/employee/approval-dashboard` is manager-only and redirects employees back to the dashboard inline in the route element.

The HR Admin app (`src/admin/`) has its own layout, sidebar, and `AdminContext` store — it is a largely separate sub-app from the employee/manager side, not just a route group.

### Backend module convention
Every domain lives under `backend/src/modules/<name>/` with the same shape: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts` (+ `.spec.ts` colocated), `entities/*.entity.ts`, `dto/*.dto.ts`. Shared cross-cutting code (guards, filters, enums, TypeORM value transformers) lives in `backend/src/common/`. All enums (roles, statuses, approver types, ledger transaction types, etc.) are centralized in `backend/src/common/enums/index.ts` — check there before adding a new status/type value.

Numeric Postgres columns (balances, accrual amounts) use `ColumnNumericTransformer` (`backend/src/common/transformers/numeric.transformer.ts`) to convert the string values `pg`/TypeORM return for `numeric` columns back into JS numbers. Use it on any new numeric column instead of parsing manually.

API is served under `/api/v1` (global prefix `api` + URI versioning, default version `1`, see `backend/src/main.ts`). Swagger docs are auto-generated at `/api/docs`.

### Leave workflow model — definition vs. execution
This is the part most likely to need re-reading multiple files to understand:
- `ApprovalWorkflow` + `ApprovalWorkflowStep` (`backend/src/modules/approval-workflows/`) is the **reusable, HR-configured definition** of a multi-step approval chain (1–3 steps, each with an `approverType`: `MANAGER` / `MANAGERS_MANAGER` / `SPECIFIC_PERSON` / `HR`).
- When an employee submits a `LeaveRequest`, the backend resolves that workflow definition into a `workflowSnapshot` (jsonb) stored on the request, and creates one `ApprovalInstance` per step (`backend/src/modules/leave-requests/entities/approval-instance.entity.ts`) — this is the **concrete, per-request execution state** (who actually needs to approve, and their current `ApprovalInstanceStatus`).
- Never conflate `ApprovalWorkflowStep` (template) with `ApprovalInstance` (a specific request's resolved step) — they look similar but serve different purposes.

### Balances are derived from an append-only ledger
`LeaveBalance` is not the source of truth by itself — every change (grant, accrual, usage, reversal, manual adjustment, carry-over, reset) is recorded as a `LeaveLedgerEntry` with a `LedgerTransactionType`. Prefer writing a ledger entry over mutating a balance field directly when touching this code, and reuse the existing balance-calculation endpoints rather than re-deriving totals ad hoc on the frontend.

### Frontend data layer
`src/services/*Api.ts` are thin wrappers around `apiFetch` (`src/services/apiClient.ts`), one file per backend module, each defining its own `Backend<Entity>` response shape. `src/services/mappers/*Mapper.ts` convert those backend shapes into the frontend's own types (`src/types/index.ts`, `src/admin/types/adminTypes.ts`). When wiring a new admin screen to real data, follow this same api-file + mapper pattern rather than calling `apiFetch` directly from a component.

**Not everything is wired to the backend yet.** `src/admin/store/AdminContext.tsx` still backs some Admin screens (notably `Departments.tsx`, `Reports.tsx`, and parts of `AdminDashboard.tsx`) with mock data (`src/admin/data/adminMockData.ts`) rather than the real API. Check whether a given admin page uses `useAdmin()`/mock data or a real `*Api.ts` service before assuming it's live.
