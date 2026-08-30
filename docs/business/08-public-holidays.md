# Public Holidays

## How holidays are organized

Public holidays are configured per country by HR on the **Public Holidays** page. Each
holiday has a name, a date, and a country, and can be marked as either:

- **One-time** — falls on that exact date only, and won't reappear next year unless HR adds
  it again.
- **Recurring (yearly)** — repeats on the same month and day every year automatically (for
  example, a fixed national holiday). HR only has to create it once.

A recurring holiday that falls on February 29th will simply be skipped in years that aren't
leap years, since that date doesn't exist in those years.

## A shared "Global" calendar

HR can create a special country entry named **Global**. Any holiday attached to the "Global"
country automatically applies to **every** country's calendar, in addition to that country's
own holidays — useful for a holiday the whole company observes regardless of location.

## Duplicate prevention

The system won't let HR create two recurring holidays on the same month/day for the same
country, or two one-time holidays on the exact same date for the same country — it will flag
this as a conflict.

## Where holidays show up

- The **Upcoming Holidays** widget on the employee dashboard shows the next holidays coming
  up, with a countdown.
- The **Public Holidays** admin page shows stats (total configured, upcoming count, number of
  countries covered, recurring vs. one-time) and visually fades out holidays that have
  already passed.

## What holidays do not currently affect

Public holidays are informational only today — they are not automatically subtracted from
the day-count of a leave request that happens to span a holiday, and there is a dedicated
"Public Holiday" leave type that is tracked and requested like any other leave type,
independent from the holiday calendar itself.
