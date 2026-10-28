# Countly — Make Every Moment Count

Free, private, offline-first countdown app (PWA) for birthdays, trips, appointments and every moment that matters.
Plain **HTML + CSS + vanilla JavaScript (ES modules)**: no framework, no build step, no backend, no accounts, no ads, no tracking.
English and Macedonian (Cyrillic) are both first-class.

> **Status: Phase 6 of 6 (polish, performance, accessibility)** — see [CHANGELOG.md](CHANGELOG.md) and [docs/PHASE_6_REPORT.md](docs/PHASE_6_REPORT.md).
> Everything is stored on the device. Sync across devices is a separate, later decision ([docs/DATA_AND_SYNC.md](docs/DATA_AND_SYNC.md)).

## Run it

```bash
npm install        # dev tooling only (puppeteer-core, axe-core); the app has no runtime dependencies
npm start          # http://localhost:5173
npm test           # ~220 unit + browser tests (needs Chrome/Edge/Chromium; set CHROME_PATH otherwise)
npm run perf       # timing probe with 500 events on a throttled CPU (node tools/perf.mjs --events=3000 for more)
node tools/shots.mjs docs/screenshots   # design screenshots at 5 viewports x 2 themes
```

Any static file host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages): serve the repository root. Service workers need HTTPS or `localhost`.

## What it does

- **Events**: create, edit, duplicate, favourite, archive, delete (with undo). Title, emoji, date, all-day or timed (with optional time zone), start date for progress, category, picture, location, description, notes, repeat (daily/weekly/monthly/yearly with interval and end date; skip or rename single occurrences).
- **Countdowns**: days, hours, minutes and live seconds that stay correct across sleep, reload and midnight; progress toward the date; milestones such as "100 days to go" and "1 year since".
- **Views**: Home, Calendar (month / week / day / agenda), Timeline (search, filter, sort), Stats (rings, donut, monthly bars, year heatmap, each with a text summary and data table), Categories manager, Memories (notes and photos), event page.
- **Memories**: a "How was it?" note per occurrence and photos stored on the device (downscaled to 1600 px), with a keyboard-friendly viewer.
- **Categories**: five built-ins plus your own (name, colour, icon, default picture); hide, reorder, delete with move.
- **Reminders**: per event, shown in the bell and (if allowed) as notifications while the app is open; `.ics` calendar export for alerts that always arrive. Limits: [docs/REMINDERS.md](docs/REMINDERS.md).
- **Share images**: Story, Square or Wide PNG in three looks, drawn on-device; system share sheet or download.
- **Backup**: versioned JSON export/import (merge or replace) including photos and categories.
- **Languages and themes**: English and Macedonian with bundled Macedonian dates and plural rules; light, dark, auto; seven accent colours; full / calm / off motion.
- **Quality**: installable, works offline, WCAG 2.1 AA checked with axe-core on every route and dialog, text scales to 200 % without horizontal scrolling, long lists render in chunks. Clearly labelled **sample events** (generated relative to today) can be hidden at any time.

## Privacy and limits

Everything stays on the device (IndexedDB for events/photos, localStorage for preferences). There are no network requests other than loading the app itself. Clearing site data deletes your events: use **Settings → Export Data** regularly. A web app cannot wake a closed browser, so reminders only fire while Countly is open; see [docs/REMINDERS.md](docs/REMINDERS.md).

## Layout

```
index.html  manifest.webmanifest  sw.js
src/app.js            shell, router, clock, reminders scheduler, onboarding
src/date/             calendar-day math (DST-safe), recurrence engine, instants
src/events/           model, categories, milestones, reminders, ics, analytics, share-card layout
src/store/            prefs, events (IndexedDB mirror), db, backup, sample data
src/i18n/             en.js, mk.js, mk-dates.js, index.js
src/components/       ui kit, navbar, cards, charts, photos, reminders, share studio, chunked lists
src/scenes/art.js     original SVG scene art
src/views/            one module per screen (lazy loaded)
src/styles/           tokens, base, layout, components, views, extras
tests/                node:test unit + puppeteer browser tests (incl. axe-core audit and perf guards)
tools/                dev server, browser helper, screenshots, perf probe
docs/                 spec, architecture, data and sync, reminders, test plan, phase reports, release checklist
```

License: MIT.
