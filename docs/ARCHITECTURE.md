# Architecture (Phase 2)

- **Runtime**: static files, ES modules, no framework, no build step, no runtime dependencies.
- **Shell** (`src/app.js`): builds sidebar / main / bottom nav, hash router (`#/`, `#/calendar`, `#/event/:id`, ...), lazy-loads each view with dynamic `import()`, re-renders on language/pref/day change. A 30 s + focus + visibility clock detects midnight and wake-up.
- **Views** are pure functions `(ctx, arg) -> HTMLElement`. `ctx` carries `today`, `events`, `prefs`, `query`, navigation and setters.
- **Dates** (`src/date/calendar.js`): floating dates are `YYYY-MM-DD` strings; day differences use `Date.UTC(y,m,d)` of calendar components, so DST and timezone changes cannot shift a countdown. Progress returns `null` without a start date.
- **State**: `store/prefs.js` (localStorage, sanitized; needed synchronously before first paint, mirrored by `src/boot.js`), `store/events.js` (Phase 1: labeled sample events; Phase 2 swaps in IndexedDB with the same shape).
- **i18n**: `en.js`/`mk.js` dictionaries, dotted keys, `{param}` interpolation, plural objects `{one, other}`. Macedonian month/weekday names and plural rule are bundled (`mk-dates.js`) because some browsers (verified: Edge 156 headless) lack Macedonian ICU data and silently fall back to English.
- **Scenes**: `scenes/art.js` returns trusted SVG strings (constants only, unique gradient ids per instance). Ambient motion is CSS (`sc-*` classes), paused offscreen via IntersectionObserver and when the tab is hidden, disabled by `prefers-reduced-motion` and the in-app switch.
- **Security**: CSP in `index.html` (`script-src 'self'`, no remote origins), user text only via `textContent`/attributes (`h()` helper); tests forbid new `innerHTML` use and remote URLs.
- **Service worker** (`sw.js`): versioned precache of the full shell, cache-first same-origin GET, navigation fallback to `index.html`, update applied only when the user reloads (`SKIP_WAITING`). `tests/project.test.js` fails if the precache list drifts from the files on disk. Bump `VERSION` on every shipped change.
- **Design tokens**: `styles/tokens.css`. Paper sheets (`--paper*`) are the light cards the approved design uses on dark screens.

## Phase 2 additions

```
src/date/recurrence.js   pure recurrence engine (anchor-based occurrences, Feb 29 / month-end policy)
src/date/instant.js      timed events: zoned -> UTC, floating local time, duration split
src/events/model.js      schema v1, validateEvent, migrateRecord (schema 0 -> 1, repair/clamp)
src/events/format.js     recurrence / time summaries
src/store/db.js          IndexedDB wrapper, versioned MIGRATIONS, memory adapter (fallback + tests)
src/store/events.js      in-memory mirror + CRUD, derivation of display items, photos, BroadcastChannel sync
```

Data flow: view -> store mutation -> IndexedDB write -> memory update -> `bump()` -> subscribers
(the router re-renders the visible view; forms are excluded) and other tabs via BroadcastChannel.
IndexedDB stores: `events`, `photos` (Blobs), `meta`. To change the schema add `MIGRATIONS[n]`
and bump `DB_VERSION`; record-shape changes go in `migrateRecord` (bump `SCHEMA`).
