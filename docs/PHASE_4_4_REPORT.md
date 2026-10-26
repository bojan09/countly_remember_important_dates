# Phase 4.4 report — milestones (and Phase 4 wrap-up)

## Delivered
- **Milestones** are derived from the event date, never stored. Only the on/off switch (`milestones`, default on) is saved with the event; it is in the create/edit form, the backup file and copies.
  - Before the event: 1 year, 100 days, 30 days, 1 week, tomorrow.
  - After it: 1 week, 30 days, 100 days, 1/2/5/10 years (year markers are skipped for repeating events, where the next occurrence is the milestone).
  - Markers that fell before the event was created or before its start date are omitted, so a new event 40 days away does not claim "100 days to go" was missed.
  - Calendar-year markers use the same month/day (Feb 29 → Feb 28 in non-leap years).
- **Event page**: a Milestones list with Done / Today / "in N days", the next one highlighted; for past events the last two done and the next two ahead. Yearly series also show "Year N since the first one".
- **Home hero**: "Next milestone: 30 days to go · in 10 days".
- The pure module `events/milestones.js` (`milestonesFor`, `nextMilestone`) is what Phase 5 reminders will use.
- English and Macedonian labels, including Macedonian plural forms. Service worker cache v9.

## Tests
190 total (+9 unit tests in `tests/milestones.test.js`, +4 browser tests in `tests/e2e.milestones.test.js`). Phase 4 as a whole added 63 tests.

## Phase 4 summary
| Step | Commit | What |
|---|---|---|
| 4.1 | e059554 | Backup, import and export |
| 4.2 | 6d1eeee | Category manager (IndexedDB v2) |
| 4.3 | 4b33e7a | Memory notes and photos |
| 4.4 | this | Milestones |

## Not verified / limits
- Milestone dates are whole calendar days; they do not follow a timed event's clock time or time zone.
- "30 days" stands in for "1 month" to keep the maths unambiguous.
- Nothing notifies you yet; reminders are Phase 5.
- The marker set is fixed (no custom milestones such as "50 days to go").
