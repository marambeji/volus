# Leave Requests and Approvals

## Submitting a request

An employee submits a leave request by choosing a leave type, a start and end date, and
(depending on the leave type's configuration) a reason, note, or supporting document. Where a
leave type allows it, individual days can be marked as **half-days** instead of a full day,
and requesting the "Public Holiday" leave type works a little differently — the employee picks
specific holiday dates from the calendar rather than a date range. The request immediately
appears in the employee's own request list with status **Pending**.

Before letting the employee submit, the request form itself checks:
- The dates aren't in the past, and the end date isn't before the start date.
- The request doesn't overlap with one of the employee's **own** other Pending or Approved
  requests.
- The leave type's configured minimum/maximum request size and maximum-consecutive-days
  limits, if any (see [Leave Types and Policies](03-leave-types-and-policies.md)).
- Whether the employee is even eligible to request that leave type at all right now — e.g. a
  waiting period after hire, or a leave type restricted to certain countries; an ineligible
  leave type is grayed out in the picker with a reason shown.
- If a note or supporting document is required for that leave type.

> **Current limitation:** if a leave type is configured to require a supporting document,
> the request form will always block submission for it — there is currently no way to
> actually attach a file anywhere in the portal. HR should avoid turning on "requires a
> document" for any leave type until file attachments are implemented, or employees using
> that leave type will never be able to submit a request.

What the request form does **not** check:
- It does not check for overlaps with **other employees'** leave — only against the same
  employee's own requests. Team-wide overlaps are instead surfaced afterwards to managers/HR
  in [Reports and Analytics](10-reports-and-analytics.md) and on the calendar.
- It allows submitting even if the employee doesn't have enough balance left — going negative
  produces a warning, not a block (see [Leave Balances and Accrual](04-leave-balances-and-accrual.md)).
- The minimum-notice-period setting is not currently checked anywhere, even though it can be
  configured on a leave type.

These checks live in the request form itself — a well-behaved user going through the normal
"Request Time Off" screen is guided by them, but they are not re-verified by the server
afterwards. This is a distinction more relevant to developers than to day-to-day HR use; see
the technical documentation if this matters for your use case.

## The approval chain

Every leave type, for every country's policy, has an **approval workflow** attached to it —
a sequence of **1 to 3 approval steps** that a request must pass through before it's fully
approved. HR configures these workflows on the **Approval Levels** page. Each step is one of
four types:

| Step type | Who approves |
|---|---|
| Manager | The employee's direct manager |
| Manager's Manager | The manager's own manager (a second-level escalation) |
| Specific Person | A named individual, chosen when the workflow is configured |
| HR | Any active HR Admin — the first HR Admin to act on it resolves the step |

A request moves through its steps in order. Only one step is ever "current" (Pending) at a
time; earlier steps must be approved before a later step becomes actionable. If a step in the
middle of the chain is marked "not required" during configuration, it's automatically skipped
over — it never becomes actionable and nobody needs to act on it, but it's shown in the
timeline as "Skipped" for transparency.

An employee can see the full approval timeline for their own request at any point, showing
each step and its current status (Waiting / Pending / Approved / Rejected / Skipped).

## Approving or rejecting

The person (or, for an HR step, anyone with the HR Admin role) whose turn it currently is on
a request can:
- **Approve it**, optionally with a comment. If this was the last required step, the whole
  request becomes fully **Approved** and the employee's balance is deducted at that moment
  (see [Leave Balances and Accrual](04-leave-balances-and-accrual.md)). If there's another
  required step after it, the request stays Pending and moves on to the next approver.
- **Reject it**, with a required reason. Rejecting at any step immediately stops the whole
  chain — every remaining step is skipped, and the request's final status becomes
  **Rejected**. A rejected request cannot be edited or reopened; if the employee still wants
  the time off, they need to submit a brand-new request.

If a policy requires a positive balance for a leave type, the system will flag/prevent a
manager from approving a request that would push the employee's balance negative.

### Managers: the Approval Dashboard

A manager's pending decisions live in one place — the **Approval Dashboard** — listing every
request currently waiting on that manager, alongside each direct report's current balances
(the "Directs Balance" tab) so the manager can make an informed call, and a team schedule
view to see who else is already off around the same dates.

### HR overrides

HR Admins have full override power over any request in the company from the **Leave
Requests** (HR) screen, regardless of whose turn it technically is in the approval chain:
- **Approve** or **Reject** a request directly.
- **Permanently delete** a request (with a required reason) — this is different from a
  regular rejection or cancellation; it removes the request from the normal flow entirely and
  marks it as "Deleted by HR." If the request had already been fully approved before being
  deleted, its balance deduction is automatically reversed.

## Automatic approval after 5 days

If a request's current step sits unattended for 5 days, the system automatically approves
just that one step on the requester's behalf (logged as an automatic action, not attributed
to a person) and moves the request forward exactly as if someone had approved it. This
prevents a request from being stuck forever if an approver simply never responds. Note this
only advances the current step — if there's a later required step, that next approver still
needs to act.

## Request statuses at a glance

| Status | Meaning |
|---|---|
| Pending | Submitted, currently waiting on someone in the approval chain |
| Approved | Fully approved through every required step; balance deducted |
| Rejected | Declined at some step; chain stopped, balance untouched |
| Cancelled | Withdrawn by the employee (see [Cancellations and Rejections](06-cancellations-and-rejections.md)) |
| Deleted by HR | Removed by an HR Admin outside the normal flow |
