# API Reference

All routes are prefixed `/api/v1` (global prefix `api` + default version `1`, see
[Architecture Overview](01-architecture-overview.md)). "Header" = requires/reads
`x-employee-id`; "AdminGuard" = requires the caller to be `HR_ADMIN` (see
[Authentication and Authorization](02-authentication-and-authorization.md)). Full request/
response shapes and business logic are in the per-module chapters linked from
[the index](README.md). Swagger UI is live at `/api/docs`.

## Employees — `/employees`
| Method | Path | Auth |
|---|---|---|
| POST | `/dev-login` | none |
| POST | `/` | header (optional, audit actor) |
| GET | `/directory` | none |
| GET | `/` | none |
| GET | `/me` | header |
| PATCH | `/me` | header |
| GET | `/me/leave-balances` | header |
| GET | `/:id` | none |
| GET | `/:id/leave-configuration` | none |
| PUT | `/:id` | header (optional) |
| DELETE | `/:id` | header (optional) |

## Departments — `/departments`, Divisions — `/divisions`, Countries — `/countries`
Identical CRUD shape, no auth on any route: `POST /`, `GET /`, `GET /:id`, `PUT /:id`,
`DELETE /:id` (204).

## Public Holidays — `/holidays`
`POST /`, `GET /?countryId=&year=`, `GET /:id`, `PUT /:id`, `DELETE /:id` (204, hard delete).
No auth.

## Leave Types — `/leave-types`
`POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` (hard delete despite "soft-delete"
label). No auth.

## Policies — `/policies`
`POST /`, `GET /`, `GET /:id`, `PUT /:id`, `DELETE /:id` (cascades to balances/ledger). No
auth.

## Leave Balances — `/leave-balances`, `/leave-ledger`
| Method | Path | Auth |
|---|---|---|
| GET | `/leave-balances/ledger` | none |
| GET | `/leave-balances/employee/:employeeId?year=` | none |
| POST | `/leave-balances/adjust` | none |
| GET | `/leave-balances` | none |
| GET | `/leave-balances/:id` | none |
| GET | `/leave-ledger/history` | none |

## Leave Requests — `/leave-requests`
| Method | Path | Auth |
|---|---|---|
| POST | `/` | header |
| GET | `/my-approvals` | header |
| GET | `/my-requests`, `/my` | header |
| GET | `/whos-out` | none |
| GET | `/calendar` | header |
| GET | `/hr` | **AdminGuard** |
| PUT | `/hr/:id/approve` | **AdminGuard** |
| PUT | `/hr/:id/reject` | **AdminGuard** |
| PUT | `/hr/:id/delete` | **AdminGuard** |
| GET | `/:id/approval-progress` | header |
| GET | `/team-availability/overview` | header |
| GET | `/:id/team-availability` | header |
| GET | `/:id` | header |
| PUT | `/:id/approve`, `/:id/reject` | header |
| PATCH`/`PUT `/:id/cancel` | header |

## Approval Workflows — `/approval-workflows`
`POST /` (header presence only), `GET /resolve`, `GET /`, `GET /:id`, `PUT /:id` (header
presence only), `DELETE /:id` (header presence only). **No `AdminGuard` on any mutating
route** — see [Known Issues](14-known-issues-and-technical-debt.md).

## Leave Reminders — `/reminders` (**entire controller behind AdminGuard**)
`GET /settings`, `PUT /settings`, `GET /history?limit=`, `POST /run`.

## Audit Logs — `/audit-logs`
| Method | Path | Auth |
|---|---|---|
| GET | `/my-notifications` | header |
| GET | `/history?entityType=&entityId=` | header |
| GET | `/global?entityType=&actionType=` | **AdminGuard** |

## Reports — `/reports`
`GET /requests`, `GET /balances`, `GET /overlaps` — all header + role-scoped (see
[Reports](07-backend-modules-reminders-mail-audit-reports.md#reports-modulereports)),
`overlaps` additionally blocks `EMPLOYEE` role.
