# Release checklist

Automated (run `npm test`, all must pass): unit tests, browser tests at 5 viewports in EN and MK, axe-core audit (both themes, phone + desktop, every route and dialog), text-scale/overflow checks, perf guards, service-worker precache integrity, i18n parity, CSP/innerHTML policy.

## Before every release
- [ ] Bump `VERSION` in `sw.js` (cache name) and `version` in `package.json` + `src/version.js` (a test keeps the last two equal).
- [ ] `npm run perf` — compare with the numbers in [ARCHITECTURE.md](ARCHITECTURE.md#performance-notes); investigate any route over 0.5 s at 500 events.
- [ ] Update CHANGELOG.md and the phase report; note anything not verified.

## Manual checks on real devices (not possible in CI — never assume they pass)
Run each on at least one iPhone (Safari + installed Home Screen app), one Android phone (Chrome + installed), and one desktop browser.

1. **Install and offline**: install, turn on airplane mode, reopen — app and your events load; a new event can be created.
2. **Persistence**: add an event and a photo, force-quit, reopen. Settings → PWA / Offline shows "Protected storage" where the browser grants it.
3. **Backup round trip**: Export Data, clear site data, Import Data (merge) — events, photos, categories restored. Test the safety backup on Replace.
4. **Notifications**: set a reminder 2 minutes ahead with the app open and notifications allowed — a system notification arrives and tapping it opens the event. Repeat with the app in the background. On iOS only works after Add to Home Screen.
5. **Calendar export**: "Add to my calendar (.ics)" opens in the native calendar with the alarm; test an event with a time zone and a yearly repeat.
6. **Share image**: Share on iOS and Android opens the share sheet with the PNG; download works on desktop; text is not clipped for your longest titles in English and Macedonian.
7. **Photos**: add from the camera and the library (including an iPhone HEIC — it should be converted by iOS or refused with a message), open the viewer, swipe/arrow, delete.
8. **Screen reader pass** (VoiceOver on iOS/macOS, TalkBack on Android, NVDA on Windows): Home → open an event → set a reminder → open the share dialog → create a category. Check that dialogs announce a title, form errors are read, charts read their summaries.
9. **Zoom and text size**: browser zoom 200 %, OS large text, landscape phone — no clipped controls or sideways scrolling.
10. **Dark/light/auto and high contrast** (Windows forced colours): all text readable, focus visible, selected states visible.
11. **Slow device**: a mid-range Android with 500+ events imported — Home and Timeline open in under a second.
12. **Upgrade path**: open a build with data from the previous version — nothing lost, update banner appears, reload applies it.
