# Users and Roles

## The three roles

Every person in the system is an **Employee** record, and every employee record has exactly
one role:

- **Employee** — a regular staff member. Can view and manage their own leave, see the team
  calendar and directory, and see their own personal reports.
- **Manager** — an employee who also has other employees reporting to them (their "direct
  reports"). A manager gets everything an employee gets, plus an **Approval Dashboard** for
  reviewing their direct reports' leave requests, a **Directs Balance** view of their team's
  leave balances, a **Team Schedule Overview**, and team-level reports instead of purely
  personal ones.
- **HR Admin** — Human Resources staff. HR Admins use a separate, full **HR Admin Portal**
  that covers the entire company rather than just one team: employee records, departments,
  leave policies, approval workflows, countries, public holidays, company-wide reports, the
  notification/reminder settings, and the audit log.

An employee's role is set by HR when their profile is created or edited, and it determines
which parts of the portal they can access. There is no separate "sign-up" process — every
user of the system must already exist as an employee record created by HR.

## Logging in

Everyone uses the same login page. You sign in with your work email; the system looks up
your employee record by that email and logs you in as whichever role your record has. If your
employee record is not marked **Active**, you cannot log in.

## What each role can see and do

### Employee
- View their own leave balances (how many days of each leave type they have left).
- Submit a new leave request, and cancel a request they've already submitted.
- Track the approval progress of their own requests.
- See the company-wide "Who's Out" list and full calendar (scoped to their own team by
  default, with the option to widen the view — see [Calendars and Team Availability](07-calendars-and-team-availability.md)).
- Browse the company directory and organization chart.
- See personal analytics: how much of their annual leave they've used, a breakdown by leave
  type, and their own request history — exportable as CSV or PDF.
- See and manage their own in-app notifications.

### Manager
Everything an employee can do, plus:
- An **Approval Dashboard** listing every leave request currently waiting on the manager's
  decision, with the ability to **Approve** or **Reject** (with a comment).
- A **Directs Balance** table showing every direct report's balance across every leave type,
  so a manager can sanity-check before approving.
- A **Team Schedule Overview** — a calendar of the whole team's approved/pending time off over
  a chosen date range (last/next 7, 14, 30 days, the current month, or a custom range).
- Team-level reports instead of personal-only reports: balances across the whole team,
  requests, and overlap analysis (see [Reports and Analytics](10-reports-and-analytics.md)).

The "Approval Dashboard" navigation link and page are only shown/available to managers.

### HR Admin
HR Admins work in a distinct **HR Admin Portal** with its own navigation, covering:
- **Employees** — create, edit, deactivate employee records company-wide.
- **Departments** and **Countries** — the organizational reference data used throughout the
  system.
- **Leave Requests** (HR view) — every request in the company, with the ability to approve,
  reject, or permanently delete a request regardless of whose turn it is in the approval
  chain (an HR override).
- **Leave Balances** — view and manually adjust any employee's balance (e.g. correcting an
  error), with a mandatory reason for every adjustment.
- **Accrual History** — a full ledger of every balance change ever made, for any employee.
- **Leave Policies** — configure entitlements per country and leave type.
- **Approval Levels** — configure the approval chains (how many steps, and who approves at
  each step) that requests must go through.
- **Public Holidays** — maintain each country's holiday calendar.
- **Notification Manager** — configure the automatic pending-approval reminder emails.
- **Reports** — company-wide analytics across every team, department, and country.
- **Audit Log** — the full history of every meaningful action taken in the system.
- **Notifications** — HR's own in-app alert feed.

## Important note on identity

The system identifies "who you are" using the account you logged in with (your email); there
is currently no password check beyond the login screen itself. HR should treat access to a
colleague's login as equivalent to acting as that person in the system, since the portal does
not currently ask for re-authentication once you're logged in with a given identity.
