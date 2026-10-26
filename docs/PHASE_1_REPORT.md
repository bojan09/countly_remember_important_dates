# Phase 1 report — PWA foundation and design system

## Delivered
Installable offline-first PWA shell; design tokens and dark/light/auto themes; 7 accents; responsive desktop/tablet/mobile chrome; Home, Calendar (month), Timeline, Stats, Categories, Memories, Event detail, Settings; EN/MK i18n; labeled sample events; modal/toast/segmented/empty-state components; onboarding. Event creation/editing is deliberately a placeholder (Phase 2).

## Tests (all passing)
64 tests: 40 unit/integration + 24 browser E2E. Details in [TEST_PLAN.md](TEST_PLAN.md). Required viewports tested: 360x640, 390x844, 768x1024, 1280x800, 1440x900.

## Issues found and fixed during the phase
- Edge/Chromium here has **no Macedonian Intl data** (dates English, wrong plurals): replaced with bundled CLDR names and rules.
- 42 calendar buttons were all tab stops: roving tabindex + arrow keys.
- Contrast failures (white on default accent 4.35:1, muted text in light theme, light accents): new tokens, per-accent ink, AA tests for every accent and theme.
- Duplicate "ready offline" toast, `null` text appended by conditional children, card text overlapping art, hero text over palm.

## Design fidelity
See [DESIGN_FIDELITY.md](DESIGN_FIDELITY.md) and [screenshots/](screenshots/). Structure, palette and hierarchy match the reference; scene art is simpler than the rendered reference and is the focus of Phase 3.

## Risks / not verified
Real devices, screen readers, install prompt UI, performance budgets, native-speaker Macedonian review.

## Git
Commit `a2f1ca9` pushed to `origin/master` (https://github.com/bojan09/countly_remember_important_dates). Single branch `master`, no PRs.
