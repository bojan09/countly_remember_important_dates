# Test plan

Run: `npm test` (Node 20+; browser tests use Edge or Chrome via puppeteer-core, skipped with a message if none is installed).

| Area | Where | Covers |
|---|---|---|
| Date engine | tests/date.test.js | DST days, leap years, month grid, progress/null policy, identical results under 4 process timezones |
| i18n | tests/i18n.test.js | key parity, placeholders, Cyrillic, key usage, plurals, bundled mk dates |
| Data/selectors/prefs | tests/data.test.js | sample events truthful for 5 reference dates, hero pick, sanitizing |
| Project integrity | tests/project.test.js | manifest + icon sizes, SW precache = files on disk, CSP, no remote URLs, no frameworks, innerHTML policy, SVG scene validity |
| Recurrence + instants | tests/recurrence.test.js | rules, Feb 29, month-end, weekly/daily across DST, until, brute-force cross-check on 36 anchor/rule pairs, identical results under 4 process time zones, zoned conversions incl. DST gap/overlap |
| Analytics | tests/analytics.test.js | monthly/daily/category counts, busiest ties, leap-year progress, done share, heatmap grid covers each day once for both week starts |
| Backup | tests/backup.test.js, tests/e2e.backup.test.js | base64, round trip through the store, merge/replace rules, hostile and malformed files, photo checks, prefs whitelist; real Settings UI export/import/replace/bad files in EN and MK |
| Categories | tests/categories.test.js, tests/e2e.categories.test.js | registry order/hidden, validation and unique names, persistence across reload, delete-with-move, v2 migration, backup round trip and merge, hostile rows; manager UI create/hide/reorder/delete, form + filter integration, EN/MK on phone |
| Model + store | tests/store.test.js | validation codes, schema-0 migration, hostile input clamping, CRUD with injected storage, reload persistence, undo, photos limits, archive, recurring derivation, skip/override, corrupted records, subscriptions |
| Phase 2 browser E2E | tests/e2e.events.test.js | real IndexedDB: create/edit/delete+undo/duplicate/archive/favorite, validation a11y, recurrence + memories, timed/zoned countdown with ticking seconds, search/sort/filter, photos, offline restart, cross-tab sync, legacy/corrupt records, sample copy, EN/MK form at 5 viewports, keyboard-only submit |
| Phase 2.1 browser E2E | tests/e2e.nav.test.js | top nav on desktop/tablet and bottom nav on mobile, dropdown keyboard/ARIA/outside-click behaviour, active section marking, preferences menu, Month/Week/Day/Agenda views incl. recurring occurrences, week/day/agenda at 5 viewports in EN and MK, density checks (14px base, hero height, two cards per phone screen) |
| Browser E2E | tests/e2e.test.js | all routes x 5 viewports (360x640, 390x844, 768x1024, 1280x800, 1440x900): no console errors, no horizontal overflow; Macedonian variant; language/theme/accent persistence; mobile nav; tabs; detail; calendar; timeline; stats; keyboard; landmarks; touch targets; reduced motion; offscreen pause; offline reload via service worker; onboarding; WCAG AA contrast (both themes, all accents) |

## Not verified / limitations

- No real-device testing (iOS Safari, Android Chrome); emulated viewports in headless Edge only.
- Install prompt and "installed" state depend on browser UI and were not exercised.
- No screen-reader session (VoiceOver/NVDA); accessible names, landmarks and focus are asserted programmatically only.
- Performance budgets are not yet measured (Phase 6).
- Visual fidelity is judged by eye against the reference, not pixel-diffed.
