# Phase 4.2 report — category manager

## Delivered
- **Manager** (Explore → Categories): per category — move up/down, hide/show, and for your own: edit and delete. Counts link to the timeline filtered by that category. "Other" always exists (fallback), can be moved but not hidden or deleted.
- **Custom categories**: name (≤30 chars, unique ignoring case, including the translated built-in names), colour (10 swatches), icon (14), and a default picture used when you create an event in that category. Limit 40.
- **Delete**: if events use the category you choose where to move them (default "Other"); nothing is deleted with it.
- **Hiding** removes a category from the event form and timeline filter only; existing events keep it. An event that already uses a hidden category still shows it in its own edit form.
- Used everywhere: event form, timeline filter and search, calendar chips, stats (donut, bars, KPI), home KPI.
- **Storage**: IndexedDB schema v2 adds a `categories` store (additive; v1 data untouched, safe to re-run). Order/hidden live in `meta`. Corrupt category rows are repaired or dropped without affecting events.
- **Backup** now carries custom categories, order and hidden. Merge adds missing categories and keeps newer local edits; replace makes them equal to the file. Events referencing a category the file doesn't define fall back to "Other".
- Icons added: chevronUp, eye, eyeOff. Service worker cache v7.

## Tests
166 total (+12 unit tests in `tests/categories.test.js`, +5 browser tests in `tests/e2e.categories.test.js`: create → form/filter/persist, validation, hide/show/reorder, delete with move, Macedonian on a 360px phone).

## Not verified / limits
- Custom names are not translated (they are whatever you type); built-ins stay translated.
- Order is changed with buttons, not drag and drop (keyboard and screen-reader friendly, but slower for long lists).
- Colours were chosen to match the built-ins; custom swatches were not run through the automated contrast audit.
- A category deleted on one device and edited on another cannot be reconciled until sync exists.
