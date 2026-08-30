# HR Leave Portal — Technical Documentation

This section documents the codebase for developers who will maintain or extend it. For a
plain-language explanation of what the product does, see
[`docs/business/`](../business/README.md) instead.

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 11 + TypeORM 1.1 (peer-compatible with TypeORM 0.3.x API) + PostgreSQL, TypeScript |
| Backend scheduling | `@nestjs/schedule` (`@Cron`) |
| Backend mail | `nodemailer` (SMTP) |
| Backend docs | `@nestjs/swagger`, served at `/api/docs` |
| Frontend | React 19 + TypeScript + Vite 8, React Router 7 |
| Frontend styling | Tailwind CSS 4 |
| Frontend charts | Recharts |
| Backend tests | Jest (`ts-jest` via `@nestjs/testing`) |
| Frontend tests | Vitest + React Testing Library, jsdom |

## Repository layout

```
volus-salim/
├── backend/                # NestJS API
│   └── src/
│       ├── main.ts               # bootstrap: CORS, versioning, validation, Swagger
│       ├── app.module.ts         # root module, wires every feature module
│       ├── common/                # cross-cutting: DTOs, enums, guards, filters, transformers
│       ├── config/                # env loading + validation
│       ├── database/              # data-source.ts (CLI), migrations/, seeds/
│       └── modules/
│           ├── employees/
│           ├── departments/
│           ├── divisions/
│           ├── countries/
│           ├── public-holidays/
│           ├── leave-types/
│           ├── policies/
│           ├── leave-balances/
│           ├── leave-requests/
│           ├── approval-workflows/
│           ├── leave-reminders/
│           ├── mail/
│           ├── audit-logs/
│           └── reports/
└── frontend/                # React SPA
    └── src/
        ├── App.tsx                # top-level router + session/role gating
        ├── pages/                 # employee & manager routes
        ├── admin/                 # entire separate HR Admin portal (own pages/router/layout)
        ├── components/            # shared dashboard/layout/reports/ui components
        ├── services/               # API client + one file per backend resource + mappers/
        ├── hooks/, data/, types/   # shared hooks, static/mock data, frontend-only types
        └── test/                  # Vitest setup
```

## Documentation index

1. [Architecture Overview](01-architecture-overview.md)
2. [Authentication and Authorization](02-authentication-and-authorization.md)
3. [Database Schema and Migrations](03-database-schema-and-migrations.md)
4. [Backend Modules — Organization & People](04-backend-modules-org-and-people.md) (employees, departments, divisions, countries, public holidays)
5. [Backend Modules — Leave Engine](05-backend-modules-leave-engine.md) (leave-requests, approval-workflows)
6. [Backend Modules — Balances & Policies](06-backend-modules-balances-and-policies.md) (leave-types, policies, leave-balances/ledger, accrual)
7. [Backend Modules — Reminders, Mail, Audit, Reports](07-backend-modules-reminders-mail-audit-reports.md)
8. [API Reference](08-api-reference.md) — full endpoint list
9. [Frontend Architecture](09-frontend-architecture.md)
10. [Frontend Services & API Integration](10-frontend-services-and-integration.md)
11. [Configuration and Environment Variables](11-configuration-and-environment.md)
12. [Running and Setting Up the Project](12-running-and-setup.md)
13. [Testing](13-testing.md)
14. [Known Issues and Technical Debt](14-known-issues-and-technical-debt.md) — read this before assuming a configured feature is enforced

## Conventions used in this documentation

- `path/to/file.ts:42` citations point at the reviewed source at the time this documentation
  was written — re-check the line if the file has since changed significantly.
- Only behavior actually present in the code is documented. Where a feature is configurable
  in the UI/DTOs but not enforced by any service logic, this is called out explicitly (see
  especially [Known Issues and Technical Debt](14-known-issues-and-technical-debt.md)).
