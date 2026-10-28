# Architecture

- **Runtime**: static files, ES modules, no framework, no build step, no runtime dependencies. Dev dependencies: puppeteer-core (browser tests, screenshots, perf probe) and axe-core (accessibility audit).
- **Shell** (`src/app.js`): top navigation (desktop) / bottom bar (phone), hash router (`#/`, `#/calendar`, `#/event/:id`, `#/edit/:id`, ...), lazy-loads each view with dynamic `import()`, re-renders on language/pref/day/store change (forms are left alone). A 30 s + focus + visibility clock detects midnight and wake-up; the same tick drives the reminder scheduler.
- **Views** are pure functions `(ctx, arg) -> HTMLElement`. `ctx` carries `today`, `events`, `prefs`, `query`, navigation and setters. Home builds only the layout (phone or desktop) that is on screen; long lists (Home phone tabs, Timeline, Memories) render in chunks of 30 (`components/chunked.js`).
- **Dates** (`src/date/`): floating dates are `YYYY-MM-DD` strings; day differences use calendar components, so DST cannot shift a countdown. `recurrence.js` is a pure anchor-based engine (Feb 29 and month-end clamped). `instant.js` handles timed events (zoned → UTC, floating local time).
- **State**
  - `store/prefs.js`: localStorage, sanitised, read synchronously before first paint (mirrored by `src/boot.js`).
  - `store/events.js`: in-memory mirror of IndexedDB + CRUD, derivation of display items (one-time → one item; recurring → next occurrence + last one as a memory), categories, reminders, photos, backup import/export, BroadcastChannel cross-tab sync. Display items are cached per store version and day.
  - `store/db.js`: IndexedDB wrapper with versioned `MIGRATIONS` (v1 events/photos/meta, v2 categories) and an in-memory adapter (fallback and tests).
  - `store/backup.js`: pure format, strict parser and import planner. The backup format carries `version` and per-event `updatedAt`, so it can double as a sync payload.
- **Domain rules** (pure, unit-tested, no DOM): `events/model.js` (validate/migrate), `categories.js` (registry), `milestones.js`, `reminders.js`, `ics.js`, `analytics.js`, `shareCard.js`.
- **i18n**: `en.js`/`mk.js` dictionaries, dotted keys, `{param}` interpolation, plural objects. Macedonian month/weekday names and plural rule are bundled (`mk-dates.js`) because some browsers lack Macedonian ICU data. Tests enforce key parity, placeholders and Cyrillic.
- **Scenes**: `scenes/art.js` returns trusted SVG strings (unique gradient ids per instance). Motion is CSS, paused offscreen and when the tab is hidden, disabled by `prefers-reduced-motion` and the in-app switch.
- **Security**: CSP in `index.html` (`script-src 'self'`, no remote origins, `img-src` allows `blob:`/`data:` for photos); user text only via `textContent`/attributes (`h()` helper); tests forbid new `innerHTML` paths and remote URLs; imported backups are validated field by field.
- **Service worker** (`sw.js`): versioned precache of the full shell, cache-first same-origin GET, navigation fallback, update applied on reload, `notificationclick` opens the event. `tests/project.test.js` fails if the precache list drifts from the files on disk. **Bump `VERSION` on every shipped change**; keep `src/version.js` equal to `package.json`.

Data flow: view → store mutation → IndexedDB write → memory update → `bump()` → subscribers (router re-render; other tabs via BroadcastChannel).
Schema changes: add `MIGRATIONS[n]` and bump `DB_VERSION`; record-shape changes go in `migrateRecord` (bump `SCHEMA`).

## Performance notes
Measured with `npm run perf` (500 events, CPU throttled 4×): every route renders in ≤ 0.3 s, a search keystroke in ≈ 35 ms, first contentful paint ≈ 0.3 s, ≈ 340 KB / 43 requests cold (all precached afterwards). Before the chunked lists the same data took 9.4 s on Home and 5.2 s on Timeline. `tests/e2e.perf.test.js` guards against regressions with generous budgets.
