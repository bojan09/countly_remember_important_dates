# Countly — Make Every Moment Count

Free, private, offline-first countdown app (PWA) for birthdays, trips, appointments and every moment that matters.
Plain **HTML + CSS + vanilla JavaScript (ES modules)**: no framework, no backend, no accounts, no ads, no tracking.
English and Macedonian (Cyrillic) are both first-class.

> **Status: Phase 1 of 6 complete** (PWA foundation and design system). See [CHANGELOG.md](CHANGELOG.md) and [docs/PHASE_1_REPORT.md](docs/PHASE_1_REPORT.md).
> The approved visual reference is [docs/design/COUNTLY_APPROVED_DESIGN.png](docs/design/COUNTLY_APPROVED_DESIGN.png).

## Run it

```bash
npm install        # dev tooling only (puppeteer-core for tests/screenshots); the app has no runtime dependencies
npm start          # http://localhost:5173
npm test           # unit + browser E2E tests (needs Edge or Chrome installed; set CHROME_PATH otherwise)
node tools/shots.mjs docs/screenshots   # design-fidelity screenshots at 5 viewports x 2 themes
```

Any static file host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages): serve the repository root. Service workers need HTTPS or `localhost`.

## What works in Phase 1

- Installable PWA: manifest, original icons (any + maskable), service worker precaching the whole shell, offline reload verified in tests.
- Design system: tokens for color/type/space/radius/motion, dark + light + auto themes, 7 accent colors (each with an AA-safe ink color).
- Responsive shell: desktop sidebar (collapsible), tablet icon rail, mobile header + bottom navigation with floating add button.
- Views: Home (hero, KPIs, mini calendar, event tiles / mobile card gallery with Upcoming/This Month/Past), Calendar (month), Timeline (filter + search), Stats (donut + monthly bars from real data), Categories, Memories, Event detail, Settings.
- English/Macedonian i18n with bundled Macedonian date names and plural rules (does not rely on browser ICU data).
- Clearly labeled **sample events** (generated relative to today, can be hidden) so the UI can be explored. They are never mixed with user data.
- Accessibility: landmarks, skip link, visible focus, keyboard-operable tabs/calendar (roving tabindex), `<dialog>` modals, reduced-motion (system + in-app), AA contrast tested in both themes and all accents.

## Not yet built (later phases)

Category manager, milestones, memory notes/photos (Phase 4), share image studio, reminders, backup/import/export (Phase 5), final polish (Phase 6). Disabled controls say so ("Soon") instead of pretending to work.

## Privacy and limits

Everything stays on the device. Only UI preferences are stored (localStorage). There are no network requests other than loading the app itself. A pure client-side PWA cannot deliver notifications while fully closed; reminders (Phase 5) will be reconciled when the app reopens.

## Layout

```
index.html  manifest.webmanifest  sw.js
src/app.js            shell, router, clock, onboarding
src/date/             calendar-day math (DST-safe)
src/i18n/             en.js, mk.js, mk-dates.js, index.js
src/store/            prefs, sample data, event source
src/events/           categories, selectors
src/components/       icons, ui kit, top navbar, cards, calendar grid
src/scenes/art.js     original SVG scene art
src/views/            one module per screen (lazy loaded)
src/styles/           tokens, base, layout, components, views
tests/                node:test unit + puppeteer E2E
tools/                dev server, screenshot + browser helpers
docs/                 spec, architecture, fidelity, phase reports
```

License: MIT.
