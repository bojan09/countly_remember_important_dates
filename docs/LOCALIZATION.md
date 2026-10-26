# Localization

- Languages: English (default) and Macedonian (`mk`, Cyrillic). Choice persists; first-run onboarding offers it.
- All UI strings live in `src/i18n/en.js` and `mk.js`. Tests enforce identical key sets, matching `{placeholders}`, Cyrillic content, no copied English, and that every literal `t('...')` key used in code exists.
- Plurals: bundled rules (en: one/other; mk: CLDR `one` = n%10==1 && n%100!=11), so "21 ден", "11 дена".
- Dates: Macedonian uses bundled CLDR names (`mk-dates.js`), e.g. "29 окт. 2026", "понеделник, 7 декември 2026 г.". English uses `Intl`.
- User-entered titles are never translated. Sample event titles are translated because they are app content.
- QA done: automated checks above, plus E2E at 5 viewports in Macedonian (no overflow/errors) and visual review of Macedonian home screens. Natural-language review by a native speaker is still recommended before release (Phase 6).
