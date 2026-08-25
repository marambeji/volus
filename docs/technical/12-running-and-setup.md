# Running and Setting Up the Project

## Prerequisites

- Node.js (compatible with NestJS 11 / Vite 8 / React 19 — use a current LTS).
- A PostgreSQL database (local, or a managed instance such as Supabase — see the SSL caveat
  in [Configuration](11-configuration-and-environment.md)).

## Backend setup

```bash
cd backend
npm install
# create backend/.env — see Configuration for required variables
npm run migration:run     # applies all migrations in backend/src/database/migrations/
npm run seed               # optional: idempotent sample data (leave types, countries,
                            # divisions, a default workflow+policy, 3 sample employees)
npm run start:dev          # nest start --watch, http://localhost:3000
```

Departments are **not** created by `npm run seed` — they come from migration
`1784800000000-CreateDepartments` instead, so running migrations alone already gives you the
9 default departments even before/without seeding.

Swagger UI: `http://localhost:3000/api/docs`.

### Other backend scripts (`backend/package.json`)
| Script | Purpose |
|---|---|
| `npm run start:fresh` | Kills anything on port 3000 first, then `start:dev` |
| `npm run start:debug` | `--debug --watch` |
| `npm run build` | `nest build` → `dist/` |
| `npm run start:prod` | `node dist/main` |
| `npm run lint` | ESLint with `--fix` |
| `npm run format` | Prettier write |
| `npm run migration:generate` | Generate a new migration from entity diffs |
| `npm run migration:revert` | Revert the last migration |
| `npm run migration:show` | List applied/pending migrations |

## Frontend setup

```bash
cd frontend
npm install
# optional: create frontend/.env with VITE_API_URL / VITE_GEMINI_API_KEY
npm run dev        # Vite dev server, http://localhost:5173
```

Make sure the backend's `FRONTEND_ORIGINS` env var includes whichever port Vite ends up on
(default `5173`/`5174` are already allowed out of the box — see
[Configuration](11-configuration-and-environment.md)).

### Other frontend scripts (`frontend/package.json`)
| Script | Purpose |
|---|---|
| `npm run build` | `tsc -b && vite build` — **currently fails at the `tsc -b` step**, see below |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | `oxlint` |

> **`npm run build` currently fails.** `tsc -b` reports ~30 errors, almost all unused
> imports/variables (`TS6133`) plus one genuine missing-import bug in
> `admin/pages/LeavePolicies.tsx` — see [Testing](13-testing.md#frontend-buildtypecheck-currently-fails)
> for the full list. `npm run dev` and `npx vite build` (which skips the typecheck) both work
> fine, so this only blocks the strict, type-checked production build command as documented,
> not local development.

## First login after a fresh seed

The seed script creates three sample accounts (see
[Database Schema](03-database-schema-and-migrations.md#seed-script)) — log in with any of
their emails on the login screen (password field is not actually checked against anything
meaningful, see [Authentication and Authorization](02-authentication-and-authorization.md)):

| Email | Role |
|---|---|
| `admin@novelus.com` | HR Admin |
| `gabriel@novelus.com` | Manager |
| `maram@volus.com` | Employee |

## Database migrations reference

See the full chronological list in
[Database Schema and Migrations](03-database-schema-and-migrations.md#migrations-chronological).
Note migrations `1784870000000-DropCheckWorkflowStepSpecificPerson` and
`1784870000000-RemoveEmployeeNumberAndMakePhoneRequired` share an identical timestamp — check
`backend/src/database/data-source.ts`'s explicit migration array for their actual run order
before writing a new migration that depends on ordering relative to either.
