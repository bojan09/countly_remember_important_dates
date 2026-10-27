# Reminders: what works without a server, and what does not

Everything is stored on the device. There is no backend in this phase.

## What Countly does
- You choose reminders per event: at the event time, 1 hour before (timed events only), 1 day, 2 days or 1 week before. All-day events remind at 09:00 local on the chosen day. Day offsets keep the same wall-clock time across daylight-saving changes.
- While Countly is open (checked every 30 seconds, when the tab regains focus, and at start) due reminders:
  - light a dot on the bell and appear in its list for 3 days (until "Mark all as read"),
  - and, if you allowed notifications, are raised as system notifications (at most 3 at once; more become one summary). Tapping one opens the event.
- A reminder is announced once. An event created after its reminder time had already passed does not announce retroactively.

## What a web app cannot do
- Wake a closed browser or a closed installed app to show a notification. Notification Triggers (scheduled local notifications) are not shipped in any major browser, and Web Push needs a server. So with Countly closed, reminders are only noticed when you next open it (they then appear under the bell, and as one notification if allowed).
- On iPhone/iPad, notifications work only after "Add to Home Screen".

## The dependable alternative: calendar export (.ics)
"Add to my calendar" on an event, or "Add all events to calendar" in Settings, downloads an iCalendar file with each event, its repeat rule, skipped dates and reminders as alarms. Your phone's or computer's calendar app then alerts you even when Countly is closed.
Known differences from Countly's own engine:
- Month-end and Feb 29 repeats follow the calendar standard (a "31st of every month" series skips short months; Countly clamps to the last day).
- Per-occurrence renames/notes are not exported.
- Timed events without a time zone are exported as floating local time; ones with a zone are converted to UTC. Duration is fixed at 1 hour.
- Importing again creates duplicates in some calendar apps; events carry stable ids (`<id>@countly.app`) so apps that honour UID update instead.

## When a backend arrives (later phase)
Web Push from a server would make closed-app reminders possible; the reminder rules in `src/events/reminders.js` are pure so the server (or a worker) can reuse them.
