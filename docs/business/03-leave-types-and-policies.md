# Leave Types and Policies

## Leave types

A **leave type** is a category of absence, such as Annual Leave or Sick Leave. The system
ships with ten leave types by default:

| Leave type | How it's tracked |
|---|---|
| Annual Leave | Running balance |
| Public Holiday | Running balance |
| Compensation | Running balance |
| Overtime | Running balance |
| Sick Leave | Used-this-year count |
| Maternity Leave | Used-this-year count |
| Paternity Leave | Used-this-year count |
| Bereavement Leave | Used-this-year count |
| Unpaid Leave | Used-this-year count |
| Other | Used-this-year count |

Every leave type is tracked in one of two ways:

- **Running balance** — the employee has a pool of days that goes up (through accrual or an
  initial grant) and down (through usage), and the portal shows how many days are currently
  available. Annual Leave is the typical example.
- **Used-this-year count** — the employee has a fixed yearly entitlement, and the portal
  simply shows how many of those days have been used so far this year, without a
  month-by-month running balance. Sick, Maternity, Paternity, Bereavement, Unpaid, and Other
  leave work this way by default.

HR can add new leave types, rename them, recolor them for the charts/calendars, reorder them,
and activate/deactivate them from the **Leave Policies** configuration area.

A leave type on its own does not carry an entitlement — the number of days someone gets
comes from the **policy** applied to their country (below).

## Leave policies

A **leave policy** belongs to exactly one country. It defines, for that country, how many
days of each leave type an employee is entitled to, and what approval process each leave type
follows. This means two countries can offer very different entitlements for the same leave
type — for example, Annual Leave could be 20 days in one country's policy and 25 in another's.

Policies can optionally be tagged with one or more **divisions** as a label to help HR find
the right policy in a long list — this tag is descriptive only and does not change which
employees receive the policy.

### How an employee gets a policy

- When HR creates an employee, HR can pick a specific policy directly, **or**
- If none is picked, the employee automatically gets their country's active policy.

If HR later changes an employee's policy, their old balances stay on record for history, and
new balances are set up under the new policy for any leave type that didn't already have one.

### What can be configured per leave type, within a policy

For each leave type inside a policy, HR configures a set of rules:

- **Entitlement (days per year)** — the core number that drives the employee's balance.
- **Accrual** — whether the entitlement is granted all at once when the employee joins, or
  builds up gradually (monthly or yearly) instead. See
  [Leave Balances and Accrual](04-leave-balances-and-accrual.md) for how this actually plays
  out.
- **Approval workflow** — every leave type in a policy must have an approval chain assigned
  to it (see [Leave Requests and Approvals](05-leave-requests-and-approvals.md)); the system
  will not let HR save a policy that leaves a leave type without one.
- A number of finer-grained rules that HR can also set per leave type: whether half-days are
  allowed, whether a note or supporting document is required, a minimum notice period before
  the leave date, a cap on consecutive days, minimum/maximum days per request, a maximum
  balance cap, a waiting/probation period after hire before the leave type becomes usable, an
  "only in these countries" restriction, and carry-over/reset rules for unused days at
  year-end.

> **Current limitations:**
> - Minimum/maximum request size and the maximum-consecutive-days cap **are** checked when an
>   employee submits through the normal request form (see
>   [Leave Requests and Approvals](05-leave-requests-and-approvals.md)).
> - The **minimum notice period** and **carry-over/year-end reset** settings can be configured
>   on screen today, but are **not currently enforced anywhere** — they have no effect on what
>   an employee can submit or on what happens to their balance at year-end. HR should not
>   assume these are being applied automatically.
> - "Requires a positive balance" is only checked when a manager tries to **approve** a
>   request, not at submission.
> - "Requires a document" will permanently block submission for that leave type, since there
>   is currently no way to attach a file anywhere in the portal — avoid enabling it until file
>   attachments exist.

### Overdraft is currently allowed

An employee can submit a leave request even if they don't have enough balance left — the
system does not block the submission. The "requires a positive balance" rule on a leave type
is only checked at the **approval** step (see above), not at submission. HR/managers should
keep an eye on balances shown at approval time rather than assuming the system will always
stop an over-drawn request from being created.

### Gender is not a leave-eligibility rule in the system today

Even though Maternity and Paternity are separate leave types, the system does not currently
restrict who can request them based on gender — any employee could technically submit a
Maternity or Paternity request, and nothing in the leave type or policy configuration
enforces otherwise. The one place gender is used at all is a display convenience in the HR
Admin's **Leave Balances** screen, which hides the Maternity balance row for employees marked
male and the Paternity balance row for employees marked female, purely to declutter that one
screen — it is not an eligibility rule and has no effect anywhere else in the portal.
