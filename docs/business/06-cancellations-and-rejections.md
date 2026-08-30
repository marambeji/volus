# Cancellations and Rejections

## Cancelling a request (employee-initiated)

An employee can cancel their own leave request from either **My Info** or **Leave Tracking**.
A few important rules:

- **Both Pending and already-Approved requests can be cancelled** — there is no extra
  approval step required to cancel a request that had already been approved. The employee can
  do it unilaterally.
- There is currently **no restriction based on dates** — an employee can cancel a request
  even after its start date, or even after it has already ended. HR should be aware of this
  when reviewing history, since a "cancelled" request in the past doesn't necessarily mean it
  was cancelled before it happened.
- A **Rejected** request cannot be cancelled (there's nothing to cancel — it never went into
  effect).
- Cancelling an already-**Approved** request automatically gives the used days back to the
  employee's balance (see [Leave Balances and Accrual](04-leave-balances-and-accrual.md)).
  Cancelling a still-Pending request has no balance effect, since nothing had been deducted
  yet.

## Rejecting a request (approver-initiated)

Whoever's turn it is in the approval chain (a manager, a specific named approver, or an HR
Admin for an HR step) can reject a request instead of approving it. A reason is always
required. Rejecting:

- Immediately stops the entire approval chain — any remaining steps are marked as skipped,
  they are never acted on.
- Sets the request's final status to **Rejected**.
- Has no effect on the employee's balance, since a request is only ever deducted once it has
  been **fully** approved — a rejection never reaches that point.

## No resubmission — start fresh instead

There is currently no "edit and resubmit" option for a rejected request, and a rejected or
cancelled request cannot be reopened. If the employee still needs the time off, the only path
is to submit a brand-new leave request from scratch.

## HR's deletion power

Separately from cancellation and rejection, an HR Admin can permanently **delete** any
request from the HR Leave Requests screen, with a required reason — see
[Leave Requests and Approvals](05-leave-requests-and-approvals.md#hr-overrides) for details.
This is intended for exceptional/administrative cases (e.g. a request entered by mistake),
not as HR's everyday way of declining a request — a normal reject accomplishes that with a
cleaner audit trail.
