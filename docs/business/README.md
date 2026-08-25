# HR Leave Portal — Business Documentation

This section explains **how the HR Leave Portal works from a business and day-to-day usage
point of view**. It is written for HR staff, managers, business owners, and anyone who uses
the product but doesn't need to know how it's built. There is no code in this section —
for architecture and implementation details, see [`docs/technical/`](../technical/README.md).

## Who uses the portal

The portal has three kinds of users, all logging into the same website with the same login
screen — what each person sees depends on their assigned role:

| Role | Who they are | What they see |
|---|---|---|
| **Employee** | Any regular staff member | Their own leave balance, their own requests, the team calendar, company directory, personal reports |
| **Manager** | An employee who has people reporting to them | Everything an employee sees, **plus** an Approval Dashboard to review and decide on their direct reports' leave requests, and team-wide reports |
| **HR Admin** | Human Resources / people-ops staff | A separate **HR Admin Portal** covering the whole company: employees, departments, leave policies, approval rules, countries, public holidays, company-wide reports, notification settings, and an audit trail of every change made in the system |

See [Users and Roles](01-users-and-roles.md) for full detail.

## Table of contents

1. [Users and Roles](01-users-and-roles.md) — who can do what
2. [Organization Structure](02-organization-structure.md) — departments, divisions, countries
3. [Leave Types and Policies](03-leave-types-and-policies.md) — what kinds of leave exist and how entitlements are configured
4. [Leave Balances and Accrual](04-leave-balances-and-accrual.md) — how many days someone has, and how that number changes over time
5. [Leave Requests and Approvals](05-leave-requests-and-approvals.md) — how someone asks for time off, and how it gets approved
6. [Cancellations and Rejections](06-cancellations-and-rejections.md) — what happens when a request is withdrawn or declined
7. [Calendars and Team Availability](07-calendars-and-team-availability.md) — seeing who's out, the company calendar, and the staff directory
8. [Public Holidays](08-public-holidays.md) — country-specific holiday calendars
9. [Notifications and Reminders](09-notifications-and-reminders.md) — in-app alerts and automatic reminder emails
10. [Reports and Analytics](10-reports-and-analytics.md) — dashboards, exports, and overlap detection
11. [Audit Log](11-audit-log.md) — the permanent record of who did what
12. [Employee Records](12-employee-records.md) — profile fields, statuses, manager rules
13. [Employee Dashboard and AI Assistant](13-dashboard-and-assistant.md) — dashboard widgets and the HR chat assistant

## A note on scope

Every feature described in this documentation reflects what the product **actually does
today**, based on a direct inspection of the current system. Where a setting exists in the
product but doesn't currently have any effect (for example, a few advanced policy rules that
can be configured but aren't yet enforced), this is called out explicitly in the relevant
chapter so HR doesn't rely on a rule that isn't actually being applied yet.
