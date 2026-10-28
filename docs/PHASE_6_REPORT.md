# Phase 6 report — polish, performance, accessibility

## Measured first, then fixed
`tools/perf.mjs` (also `npm run perf`) cold-loads the app, imports a synthetic data set through the real import path and times every route and a few interactions, optionally with a throttled CPU.

| 500 events, CPU ×4 | Before | After |
|---|---|---|
| Home | 9.4 s | 0.21 s |
| Timeline | 5.2 s | 0.27 s |
| Memories | 1.3 s | 0.21 s |
| Search keystroke (worst) | 5.2 s | 0.03 s |
| 3000 events: Home / Timeline | not measured | 0.29 s / 0.19 s |

Cause: every list rendered all events at once, each with its own SVG scene, and Home built both the phone and the desktop layout. Fix: lists render 30 rows at a time with a "Show more (N left)" button (keyboard focus moves to the first new row), only the visible Home layout is built (the other is built if the window crosses the breakpoint), search is debounced, and off-screen rows use `content-visibility`. Cold start is unchanged: first paint ≈ 0.3 s, no layout shift, ≈ 340 KB and 43 requests (all precached afterwards).

## Accessibility audit (axe-core, new devDependency)
Every route, calendar mode, stats tab and dialog, light and dark, phone and desktop, WCAG 2.0/2.1 A+AA plus best practices. Real findings, all fixed:
- Agenda/day secondary text 2.4:1 contrast; danger row in dialogs 3.1:1; muted text on the light event sheet 3.1:1.
- Mobile Home and the "event not found" page had no level-one heading.
- The photo file input had no accessible name.
- Week view used an invalid `listitem` role on `section`.
The audit is now a test (`tests/e2e.a11y.test.js`, 4 combinations). Its detector was sanity-checked against deliberately broken markup.

## Polish
- Removed outdated "arrives in a later update" / "Soon" copy and dead code paths (event page, calendar, stats, settings, create).
- Timeline `?cat=` now accepts your own categories (it only knew the built-ins).
- Text scales to 200 % at 320 px wide in EN and MK with 80-character unbroken titles and 30-character category names: one real overflow (agenda) fixed; guarded by `tests/e2e.polish.test.js`, which also checks focus returning to the opener after dialogs, distinct page titles and landmarks.
- Windows forced-colours styles for switches, chips and meters.
- About shows the real version (`src/version.js`, kept equal to `package.json` by a test).
- README, ARCHITECTURE and the new RELEASE_CHECKLIST rewritten to match what exists.

## Tests
Full suite and budgets: see TEST_PLAN.md. Added: axe audit (4), polish (5), perf guards (3), version check (1).

## Not verified / limits
- No real devices or screen readers: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) lists the manual passes still owed (iOS install/notifications/share, TalkBack/VoiceOver, slow Android).
- axe finds a subset of accessibility problems; colour contrast over scene art is not machine-checkable.
- Perf numbers come from headless Chromium on a shared machine with simulated throttling; treat them as relative.
- Not done: bundling/minifying the JS (43 unbundled requests are fine with the service worker and HTTP/2, but a first visit over slow HTTP/1.1 would be slower), image lazy-decoding of scene SVGs beyond `content-visibility`, an hourly day view.
