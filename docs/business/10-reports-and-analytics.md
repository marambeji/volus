# Reports and Analytics

Reporting is available at three levels, automatically scoped to who's looking:

- **Employee** — a personal report: how much of their annual leave they've used, a
  percentage breakdown by leave type, a monthly usage chart, and their own request history.
  Only ever shows the employee's own data.
- **Manager** — a team report scoped to their direct reports only: team balances, team
  requests, and overlap analysis for their own team.
- **HR Admin** — a company-wide **Reports Dashboard** covering everyone, with the option to
  narrow the view down to one specific manager's team if needed.

Both the manager and HR views can be filtered by date range, leave type, department, country,
manager, and request status, and both support exporting the current view to CSV or to a
formatted PDF report.

## The HR Reports Dashboard tabs

- **Leave Balances** — every employee's balance across every leave type, with negative
  balances visually flagged.
- **Leave Requests** — every request in scope, with full filtering.
- **Overlaps** — see below.
- **Leave Types** — totals per leave type: how many requests, how many approved days, and how
  many distinct employees used it. Clicking a leave type drills down into the list of
  employees who used it and their individual totals.
- **Countries** — employee counts and approved days used, per country.
- **Departments** — employee counts and approved days used, per department.

Every chart in these tabs is clickable — clicking a bar filters the table below it down to
just that slice (e.g. click "Annual Leave" to see only Annual Leave rows).

## Overlap detection ("who's off at the same time")

The Overlaps view answers "were too many people out at once?" It works like this:

- The system looks at every **approved** leave request in the selected period and groups
  requests whose dates overlap into clusters. If Request A overlaps Request B, and Request B
  overlaps Request C, all three end up in the same cluster together — even if A and C don't
  directly overlap each other — because they form a connected chain of overlapping time off.
  Only clusters of **two or more** overlapping requests are shown (a single person on leave
  alone is not an "overlap").
- A histogram shows, for every day in the period, exactly how many people were on approved
  leave that day. Clicking a day filters the list below to just the people who were out that
  specific day.
- **Peak Concurrent Absences** is the single highest number of people who were out on any one
  day in the period.
- **Overlapping Days** counts how many distinct days in the period had two or more people out
  at the same time.

If you click a day where only one person happened to be out, the panel below correctly shows
"not an overlap" rather than an empty/broken result — that's expected, not a bug: an overlap
by definition needs at least two people out on the same day, and this particular day only had
one.
