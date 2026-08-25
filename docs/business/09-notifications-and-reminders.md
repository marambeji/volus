# Notifications and Reminders

There are two separate notification mechanisms in the portal: **in-app notifications** (an
activity feed everyone sees inside the portal) and **automatic email reminders** (emails sent
to approvers about requests awaiting their decision).

## In-app notifications

Every meaningful action in the system — a leave request submitted, approved, rejected,
cancelled, or deleted by HR; a balance adjusted; an approval step decided — generates an
entry in an activity feed. Both the employee/manager portal and the HR Admin portal have:

- A **bell icon** in the header showing a red badge with the number of unread items (capped
  at "99+" once it passes 99, so the badge never becomes unreadably large).
- A quick dropdown preview from the bell.
- A full **Notifications** page listing every item, with search, the ability to mark one or
  all as read, and pagination.

An employee or manager's feed is filtered to what's relevant to them personally (their own
requests and the approval actions on them); HR Admin's feed shows the company-wide activity
stream. Marking something "read" only affects your own view — it's tracked per person, not
globally.

## Automatic email reminder settings

HR configures automatic reminder emails from the **Notification Manager** page:

- A single on/off switch for the whole feature.
- **How long a step can sit unattended before a reminder is sent** — a quick preset of 24, 48,
  or 72 hours, or a custom number of hours from 1 up to 720 (30 days).

When enabled, the system automatically checks, in the background, for any approval step that
has been sitting Pending longer than the configured delay, and emails the current approver
(the manager, specific person, or every active HR Admin, depending on the step) a reminder
that a leave request is waiting on them. **This check runs automatically on its own, roughly
once an hour, for as long as the feature is switched on — HR does not need to do anything for
reminders to go out.**

The same approver won't be reminded twice for the same request step — once a reminder has
been sent for a given step and approver, it won't be repeated even on the next automatic
check.

### "Run Check Now"

The **Run Check Now** button on the Notification Manager page triggers an immediate,
on-demand check instead of waiting for the next scheduled hourly pass — useful for testing
the settings or forcing reminders out right away. It is a manual shortcut, **not** a
requirement — the automatic hourly check happens regardless of whether anyone ever clicks
this button, as long as reminders are switched on.

### Reminder History

Every reminder email that's actually sent is logged on the same page: which employee's
request it was about, the leave type, who was reminded, the request's dates, and exactly when
the email went out. This gives HR a clear record of who's been nudged and when.
