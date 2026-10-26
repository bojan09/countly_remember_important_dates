# Product spec (consolidated)

The full requirement set is the master prompt (COUNTLY_MASTER_PROMPT.md, six phases). This file records decisions and edge-case policies as they are made.

## Policies decided in Phase 1

- **Floating dates** (birthdays, holidays) are calendar dates, not instants: countdown = whole calendar days between today (local) and the date. Moving timezones or DST never changes it.
- **Progress** exists only with an explicit start date; otherwise the UI says "No start date set" and shows no percentage. Clamped to 0-100.
- **Upcoming** = today or later; **Past** = before today; **This Month** = upcoming within the current month.
- **Hero** = soonest pinned upcoming event, else the next event.
- **Sample data** is generated relative to today, flagged `sample: true`, announced by a banner and badge, and can be hidden. Phase 2 user data is stored separately.
- Week starts Monday (user override arrives with Settings in Phase 5).

Recurrence, timezone instants, Feb 29 and month-end rules are specified when implemented in Phase 2.
