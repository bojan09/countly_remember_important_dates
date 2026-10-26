# Phase 3 report — living scenes and richer analytics

## Delivered
- **Motion**: rolling numerals on the live countdown (only changed digits flip), one-time count-up of the "N days" figure on cards and detail, one-shot confetti on the day of an event. All of it follows the in-app motion level (full / calm / off) and the system reduced-motion setting; with motion off the final text is set immediately.
- **Scenes**: 2 new animated scenes (`deadline`, `holiday`), 16 in total, with matching sample events (upcoming samples 15 → 17); scene art animation reviewed per scene.
- **Analytics** (`src/events/analytics.js`, pure and unit tested): events per month, per day, per category, busiest month/day, year progress, done-this-year share, heatmap grid and intensity levels.
- **Stats view** rebuilt with three tabs:
  - Overview: KPI tiles, three progress rings (year, done this year, next event), category donut.
  - Categories: donut plus linked per-category bars (each opens the filtered timeline).
  - Calendar: year switcher, events-per-month bars, year heatmap (each day links to the Day view).
- Every chart has a text summary for assistive tech, keyboard focus on segments/bars/days, and a "View data as a table" fallback. Colours come from the existing tokens, so both themes and all accents work.
- EN and MK strings for everything new.

## Tests
`npm test` → 134 tests (7 new analytics unit tests; the stats browser test now checks the new Calendar tab; the create → detail test waits for the count-up to settle).

## Not verified / limits
- Visual review by eye in headless Chromium only (desktop 1440 dark checked this phase); no real devices or screen readers.
- Frame rate / battery impact of the animations is not measured (Phase 6 performance pass).
- The heatmap does not stretch to full card width on very wide screens.
- Stats count sample events too, and say so ("Based on sample events").
