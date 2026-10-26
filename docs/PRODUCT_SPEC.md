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

## Policies decided in Phase 2

**Date semantics**
- *Floating* (all-day, or timed without a zone): a calendar date / local clock time. Moving time zones never changes the countdown; it targets local midnight (or the local clock time).
- *Instant* (timed + IANA zone, e.g. a flight at 07:40 Europe/Skopje): an absolute moment. The countdown stays correct if the device zone changes.
- Spring-forward gap times resolve to the first valid time after the gap; fall-back ambiguity resolves to the earlier instant.
- Lists (Upcoming/Past/This Month) are by *date*: an event later today stays "upcoming" until midnight even after its time passes.
- Day counts use calendar arithmetic, never `ms / 86 400 000`.

**Recurrence** (`daily | weekly | monthly | yearly`, interval 1-999, optional end date)
- Occurrence *k* is always computed from the series anchor date, so clamping never drifts.
- Monthly on the 29th-31st: months that are too short use their last day, then the day returns (Jan 31 → Feb 28/29 → Mar 31 → Apr 30).
- Yearly on Feb 29: Feb 29 in leap years, **Feb 28** otherwise.
- Weekly/daily are plain calendar-day steps (DST-proof).
- A series is stored once. The UI shows its **next occurrence** (upcoming, progress runs from the previous occurrence) and its **last past occurrence** (a memory, id `seriesId@date`). Never an unbounded list, so stats count a series once.
- One occurrence can be **skipped** or have its **title/notes overridden** without touching the series; changing the series date/rule clears those exceptions (they would no longer line up).

**Lifecycle**: create / edit / duplicate / favorite / archive / delete (confirmation + 7 s Undo that restores photos too). Archived events are hidden from lists and live under Timeline → Archived. Samples are read-only; "Make my own copy" turns one into a real event.

**Validation**: title 1-80, description ≤200, notes ≤5 000, location ≤120, ≤4 emoji, valid date/time/zone, start ≤ date, end ≥ date, interval 1-999. Errors are inline, announced, and focus moves to the first one.

**Photos (foundation)**: stored as Blobs in IndexedDB on this device only; images ≤ 8 MB, ≤ 12 per event.

**Storage failure**: if IndexedDB is unavailable (private mode, quota) the app keeps working in memory and says so once; unreadable records are skipped and counted, never fatal.
