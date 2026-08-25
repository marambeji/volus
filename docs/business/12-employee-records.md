# Employee Records

Every person in the system — regardless of role — is represented by one **employee record**,
created and maintained by HR from the **Employees** page (in the HR Admin Portal).

## What's on an employee's profile

- Name, work email, phone number, job title, avatar.
- Department and team/unit (see [Organization Structure](02-organization-structure.md)).
- Country and division.
- Manager (who they report to).
- Employment type (Full-Time, Part-Time, Contractor, Intern) and work mode (Onsite, Hybrid,
  Remote) — descriptive fields shown on the directory.
- Hire date — used to work out seniority-based eligibility (like a waiting period before a
  leave type becomes usable).
- Gender — currently stored for the record only; see the note in
  [Leave Types and Policies](03-leave-types-and-policies.md) about the one place it's used.
- Up to 5 emergency contacts (name, relationship, phone).
- Their assigned leave policy (see [Leave Types and Policies](03-leave-types-and-policies.md)).

## Employee status

Every employee is **Active**, **Inactive**, or **Archived**. Only Active employees can log
in. HR toggles status from the Employee list; removing an employee entirely sets their status
to Archived rather than deleting their history outright, so their past leave records and
audit trail stay intact.

## Manager assignment rules

When HR sets or changes an employee's manager, the system enforces a few sanity rules:
- An employee **cannot be their own manager**.
- An employee **cannot be assigned an Archived person as their manager**.
- The system checks the whole reporting chain and **blocks a circular assignment** — for
  example, you can't make Employee A report to Employee B if B (directly or through a longer
  chain) already reports to A.

## What happens when an employee leaves

When HR removes (archives) an employee, anyone who reported directly to them is **not**
automatically reassigned to a new manager — their "Manager" field is simply cleared, and HR
needs to manually pick a new manager for each of them afterward.

## Clearing an employee's leave policy

If HR removes an employee's assigned leave policy without picking a replacement, the system
warns that this will delete their leave balances (any balance with no usage history yet) —
see [Leave Balances and Accrual](04-leave-balances-and-accrual.md).
