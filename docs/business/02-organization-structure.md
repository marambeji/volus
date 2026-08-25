# Organization Structure

The portal organizes the company along three independent reference lists, each maintained by
HR: **Departments**, **Divisions**, and **Countries**.

## Departments

A department is a label like "Engineering", "Marketing", "Human Resources", "Finance",
"Sales", "Operations", "Legal", "Design", or "Executive" — the system ships with these nine
by default, and HR can add, rename, recolor, or remove departments from the **Departments**
page.

Each department can optionally have a **department head** (one employee designated as its
lead) and a color, used to visually distinguish departments throughout the dashboards and
charts. Clicking a department in the admin portal jumps straight to a pre-filtered list of
that department's employees.

An employee's department is simply the text label attached to their profile — assigning an
employee to "Engineering" links them to that department by name. Removing a department from
the list does **not** automatically move or clear the employees who were labeled with it;
their profiles keep showing that department name until HR manually reassigns them.

### Teams within a department

Employees can also be tagged with a free-text **unit/team** name (e.g. "Frontend Team" within
Engineering). The Departments page shows a "Teams" breakdown for each department, grouping
that department's employees by this tag — a lightweight way to see sub-groupings without
creating a whole separate structural entity for it.

## Divisions

Divisions are a second, independent grouping — broader regional groupings such as "Levant",
"Gulf", "Europe", "Africa", or "Global" in the default setup. Divisions are used in a couple
of places:
- An employee can optionally belong to a division.
- A leave policy can be tagged as applying to one or more divisions, purely as a descriptive
  label to help HR find the right policy when there are many — it does not change which
  employees actually receive that policy (see [Leave Types and Policies](03-leave-types-and-policies.md)).

## Countries

Every employee belongs to exactly one country, chosen from the countries HR has configured
(the system ships with Lebanon, United Arab Emirates, Saudi Arabia, United Kingdom, and
France by default, and HR can add more). Countries drive two important things:

1. **Which public holidays apply** to an employee — holidays are configured per country (see
   [Public Holidays](08-public-holidays.md)).
2. **Which leave policy (entitlements) applies** to an employee by default — each leave
   policy belongs to one country, and a new employee is automatically assigned their
   country's policy unless HR picks a different one explicitly (see
   [Leave Types and Policies](03-leave-types-and-policies.md)).

Because employees and holidays are tied to a country, HR cannot delete a country that still
has employees or holidays attached to it — the system blocks the deletion to avoid leaving
those records without a country.

## Why this matters day to day

When HR sets up a new hire, they pick a country and (optionally) a department and division.
The country decides what leave entitlements and public holidays automatically apply; the
department and division are mostly organizational/reporting labels used for filtering staff
lists, dashboards, and reports.
