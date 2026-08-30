# Architecture Overview

## Backend bootstrap (`backend/src/main.ts`)

- Loads `.env` via `dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true })` (`main.ts:3`).
- `main.ts:5` sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` **globally for the whole
  Node process** (not scoped to the DB connection) — disables TLS certificate validation for
  *any* outbound HTTPS request the process makes. See
  [Known Issues](14-known-issues-and-technical-debt.md).
- CORS: origin allowlist from `FRONTEND_ORIGINS` (comma-separated), default
  `['http://localhost:5173', 'http://localhost:5174']`; `credentials: false` (`main.ts:16-26`).
- Global route prefix `api` + URI versioning with `defaultVersion: '1'` (`main.ts:28-33`) — so
  every controller path becomes `/api/v1/...`.
- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`,
  `enableImplicitConversion: true` (`main.ts:35-44`) — DTOs are the source of truth for what a
  request body may contain; unlisted fields are stripped/rejected.
- Global exception filter: `HttpExceptionFilter` (`main.ts:46`) — see
  [Common — filters](#commonfilters) below.
- Swagger (`@nestjs/swagger`) mounted at `api/docs`, title "HR Leave Portal API" (`main.ts:48-54`).
- Listens on `process.env.PORT` or `3000` (`main.ts:56-58`).
- **No health-check endpoint, no helmet, no rate limiting, no cookie parser.**
  `AppController`/`AppService` are the untouched Nest CLI scaffold (`GET /api/v1` → literal
  string `"Hello World!"`) — not a real liveness/readiness probe.

## Module graph (`backend/src/app.module.ts`)

```
AppModule
├── ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig], validate })
├── ScheduleModule.forRoot()                — enables every @Cron in the app
├── DatabaseModule                          — TypeORM root connection
├── CountriesModule
├── DivisionsModule
├── DepartmentsModule
├── LeaveTypesModule
├── ApprovalWorkflowsModule
├── PublicHolidaysModule
├── PoliciesModule
├── EmployeesModule        (imports LeaveBalancesModule, AuditLogsModule)
├── LeaveBalancesModule
├── LeaveRequestsModule    (imports ApprovalWorkflowsModule, LeaveBalancesModule, AuditLogsModule)
├── AuditLogsModule        (@Global())
├── ReportsModule          (imports LeaveBalancesModule)
└── LeaveRemindersModule   (imports LeaveRequestsModule, EmployeesModule, MailModule)
```

There is **no `APP_GUARD`/`APP_FILTER`/`APP_INTERCEPTOR` registered in `app.module.ts`** —
`HttpExceptionFilter` is wired imperatively in `main.ts` via `useGlobalFilters`, and there is
no app-wide auth guard (see [Authentication and Authorization](02-authentication-and-authorization.md)).

`AuditLogsModule` is `@Global()` (`audit-logs.module.ts:8`), so `AuditLogsService` is
injectable anywhere without re-importing the module.

## Scheduled jobs

Three independent `@Cron` jobs run inside the same Nest process (no separate worker):

| Job | Schedule | Service | Purpose |
|---|---|---|---|
| Leave approval reminders | `CronExpression.EVERY_HOUR` (UTC) | `LeaveRemindersSchedulerService.handleReminders()` (`leave-reminders/leave-reminders-scheduler.service.ts:17`) | Emails the current approver of any pending step past the configured delay |
| Monthly accrual | `'0 6 1 * *'` UTC (1st of month, 06:00) | `AccrualSchedulerService` (`leave-balances/accrual-scheduler.service.ts:13`) | Runs `LeaveBalancesService.runAccruals(month, year)` |
| Auto-approve expired requests | `CronExpression.EVERY_DAY_AT_1AM` | `ExpiredRequestsSchedulerService` (`leave-requests/expired-requests-scheduler.service.ts:17`) | Auto-approves the current step of any request that's been Pending ≥5 days |

All three reuse the exact same service method a manual UI action would call (e.g. the
reminders cron calls `LeaveRemindersService.runReminderCheck()`, the same method the
"Run Check Now" button triggers via `POST /reminders/run`) — there is no divergent logic
between scheduled and on-demand execution.

## Common cross-cutting code (`backend/src/common/`)

### `common/guards/`
`AdminGuard` is the **only** guard in the codebase — see
[Authentication and Authorization](02-authentication-and-authorization.md).

### `common/filters/` {#commonfilters}
`HttpExceptionFilter` (`http-exception.filter.ts:17-61`), `@Catch()` (catches everything):
- Nest `HttpException` → reuses its status/message.
- Postgres unique-violation (`23505`) or FK-violation (`23503`) → HTTP 409 with
  `Conflict: <detail>`.
- Anything else → HTTP 500 with the error's message.
- Response shape: `{ statusCode, timestamp, path, message: string[] }` (message always an
  array, even for a single string).

### `common/transformers/`
`ColumnNumericTransformer` (`numeric.transformer.ts`) converts Postgres `numeric` columns
(which `pg`/TypeORM return as strings) into JS numbers on read; used on every `numeric(...)`
column across entities (`durationDays`, balances, ledger amounts, etc.).

### `common/dto/pagination.dto.ts`
`PaginationQueryDto` (`page`, `limit`, `q`, `sortBy`, `sortOrder`) and a `paginate<T>()` helper
returning `{ data, meta: { page, limit, total, totalPages } }` — the shared shape used by
every paginated list endpoint across modules.

### `common/enums/index.ts`
Every domain enum lives in this one file — see
[Database Schema and Migrations](03-database-schema-and-migrations.md#enums) for the full
list with values.

## Frontend shell

`frontend/src/main.tsx` mounts `<App/>` inside `<StrictMode>`. `App.tsx` owns all routing and
session state — see [Frontend Architecture](09-frontend-architecture.md) for the full
breakdown. There is a hard structural split: `role === 'admin'` renders an entirely separate
sub-application (`frontend/src/admin/AdminApp.tsx`, its own router/layout/pages), while
`manager`/`employee` share one `Layout` + route set under `frontend/src/pages/`.
