# Test plan

Run: `npm test` (Node 20+; browser tests use Edge or Chrome via puppeteer-core, skipped with a message if none is installed).

| Area | Where | Covers |
|---|---|---|
| Date engine | tests/date.test.js | DST days, leap years, month grid, progress/null policy, identical results under 4 process timezones |
| i18n | tests/i18n.test.js | key parity, placeholders, Cyrillic, key usage, plurals, bundled mk dates |
| Data/selectors/prefs | tests/data.test.js | sample events truthful for 5 reference dates, hero pick, sanitizing |
| Project integrity | tests/project.test.js | manifest + icon sizes, SW precache = files on disk, CSP, no remote URLs, no frameworks, innerHTML policy, SVG scene validity |
| Browser E2E | tests/e2e.test.js | all routes x 5 viewports (360x640, 390x844, 768x1024, 1280x800, 1440x900): no console errors, no horizontal overflow; Macedonian variant; language/theme/accent persistence; mobile nav; tabs; detail; calendar; timeline; stats; keyboard; landmarks; touch targets; reduced motion; offscreen pause; offline reload via service worker; onboarding; WCAG AA contrast (both themes, all accents) |

## Not verified / limitations

- No real-device testing (iOS Safari, Android Chrome); emulated viewports in headless Edge only.
- Install prompt and "installed" state depend on browser UI and were not exercised.
- No screen-reader session (VoiceOver/NVDA); accessible names, landmarks and focus are asserted programmatically only.
- Performance budgets are not yet measured (Phase 6).
- Visual fidelity is judged by eye against the reference, not pixel-diffed.
