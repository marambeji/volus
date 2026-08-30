# Leave Balances and Accrual

## What a "balance" means

For each employee and each leave type, the portal shows a balance made of three numbers:

- **Entitlement** — how many days they're allowed per year under their policy.
- **Used** — how many days they've already taken (only counts fully **approved** leave —
  pending or rejected requests never count as used).
- **Available** — how many days they have left to use.

For "running balance" leave types (like Annual Leave), Available is calculated from the
running history of grants, accruals, usage, and any manual adjustments. For "used-this-year"
leave types (like Sick Leave), Available is simply the yearly Entitlement minus what's been
used so far.

A "Pending" figure is also shown — this is the total of any requests the employee has
submitted for that leave type that are still waiting on approval; it's informational only and
does not reduce the Available balance until/unless the request is actually approved.

## How a balance gets its starting days

When HR creates an employee (or assigns them a leave policy), each leave type in that policy
is set up one of two ways:

- **Granted immediately** — if the leave type isn't set up to accrue over time, the employee
  receives the full year's entitlement the moment they're set up, recorded as an "Initial
  Grant."
- **Builds up over time (accrual)** — if the leave type is set up to accrue, the employee
  starts at zero and gains days automatically over time (see below).

## Automatic accrual

For leave types configured to accrue, the system adds days automatically on a schedule:

- **Monthly accrual** adds the configured amount every month.
- **Yearly accrual** adds the configured amount once, every January.

This runs automatically in the background at the start of each month — nobody needs to
trigger it manually. If a leave type has a maximum balance cap configured, accrual will stop
adding days once the cap is reached rather than going over it.

> **Current limitation:** the portal lets HR configure tenure-based accrual tiers ("seniority
> milestones," e.g. "after 3 years, accrue faster") in the Leave Policies screen, but these
> tiers are **not currently applied** — accrual always uses the single flat rate configured
> on the leave type, regardless of how long someone has been employed. Treat the seniority
> milestone fields as reserved for a future release rather than active today.

## Manual adjustments (HR only)

HR can manually add or subtract days from any employee's balance from the **Leave Balances**
screen — for example, to correct a data-entry mistake or grant a one-off bonus day. Every
adjustment requires:
- A non-zero amount (positive to add, negative to subtract).
- A reason of at least a few words, which is permanently recorded.

The system will refuse an adjustment that would push a balance below zero.

## The ledger (Accrual History)

Every single change to every balance — initial grants, monthly/yearly accruals, leave usage,
reversals, and manual adjustments — is permanently recorded as one line in a ledger. HR can
browse this full history per employee on the **Accrual History** page: what changed, by how
much, why, and what the resulting balance was after that change. This is the definitive
record for auditing "why does this person have X days left."

## When a balance actually changes because of a leave request

- **Submitting** a request does not change the balance at all (it only shows up in the
  "Pending" figure).
- **Approving** a request — specifically, the final approval that completes its entire
  approval chain — is the moment the days are actually deducted from the balance.
- **Cancelling an already-approved request**, or **HR deleting an already-approved request**,
  automatically gives the days back (a "reversal"), since they were only deducted once
  approval had fully completed. Cancelling or rejecting a request that was never fully
  approved has no balance effect, since nothing was deducted yet.

There is no separate "undo" button for balances beyond this — a reversal only ever happens
automatically as the direct result of cancelling or deleting a request that had already been
approved.

## Carry-over and year-end reset

The Leave Policies screen lets HR configure whether unused days carry over into the next
year, up to what cap, and whether they later expire — as well as a general "reset" rule for
each leave type. **These settings are not currently enforced anywhere in the system** — no
carry-over or year-end reset is ever actually applied to a balance today. HR should not rely
on these settings and should track any needed year-end carry-over manually (e.g. via a manual
adjustment) until this is implemented.
