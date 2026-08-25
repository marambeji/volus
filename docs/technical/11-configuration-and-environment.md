# Configuration and Environment Variables

## Backend (`backend/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development`\|`production`\|`test` | `development` |
| `DATABASE_URL` | Full Postgres connection string (preferred over discrete fields) | — |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Discrete connection fields, used if `DATABASE_URL` unset | `DB_PORT` defaults to `5432` |
| `DB_SSL` | Enable TLS to the DB | see caveat below |
| `DB_SSL_REJECT_UNAUTHORIZED` | Verify the DB's TLS certificate | see caveat below |
| `FRONTEND_ORIGINS` | Comma-separated CORS allowlist | `http://localhost:5173,http://localhost:5174` |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | SMTP for reminder emails | `MAIL_PORT` defaults `587`; `MAIL_FROM` falls back to `MAIL_USER` then `'no-reply@volus.app'` |

At least one of `DATABASE_URL` or `DB_HOST` is required — `config/env.validation.ts:98-103`
throws at startup otherwise.

### ⚠️ SSL handling is inconsistent across three code paths

Three different places compute the DB SSL settings differently, from the **same** env vars:

1. **`config/env.config.ts:10-11`** (used by `DatabaseModule`, i.e. the actual running app):
   `ssl = process.env.DB_SSL === 'true' || true` — this is **always `true`** regardless of
   `DB_SSL`'s value (the `|| true` makes the left side irrelevant). `rejectUnauthorized` is
   **hardcoded `false`** ("Always false for development to bypass self-signed errors"). In
   effect: the running app always connects over SSL with certificate validation off, no
   matter what `.env` says.
2. **`config/env.validation.ts`**: treats `DB_SSL` (default `false`) and
   `DB_SSL_REJECT_UNAUTHORIZED` (default `true`) as real, independently meaningful toggles —
   consistent with what an operator would expect, but **not what actually happens** at
   runtime per #1.
3. **`database/data-source.ts:36-37`** (used by the CLI — migrations, and by the seed script):
   `ssl = process.env.DB_SSL === 'true'` (a real toggle) and
   `rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'` (defaults to
   strict unless explicitly disabled) — **the opposite defaults from #1**.

**Practical effect**: the running API server and the CLI/seed script can end up using
different SSL behavior for the same `.env` file. If you need to change SSL behavior, you must
edit `env.config.ts` and `data-source.ts` separately — changing `DB_SSL`/
`DB_SSL_REJECT_UNAUTHORIZED` alone will not change the running app's behavior at all today.

### ⚠️ Process-wide TLS validation is disabled

`main.ts:5` sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` unconditionally at
bootstrap — this disables Node's TLS certificate validation for **every** outbound HTTPS call
the process makes for its entire lifetime (not just the DB connection), including e.g. the
SMTP connection if it uses TLS. Be aware of this before adding any new outbound integration
that should be verifying certificates.

## Frontend (`frontend/.env` / Vite env)

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Backend base URL | `http://localhost:3000/api/v1` |
| `VITE_GEMINI_API_KEY` | Google Gemini API key for the in-app `Chatbot` component (called directly from the browser) | none — chatbot falls back to reading a key from `localStorage` if unset |

## Other config files worth knowing about

- `backend/src/config/env.validation.ts` — `class-validator`-based `EnvironmentVariables`
  class; startup fails fast if required vars are missing/malformed.
- `frontend/vite.config.ts` — also hosts the Vitest `test` config block (there is no separate
  `vitest.config.ts`), see [Testing](13-testing.md).
- `backend/nest-cli.json`, `tsconfig*.json` — standard Nest/TS project config, no unusual
  overrides found.
