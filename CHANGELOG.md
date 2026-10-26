# Changelog

## Phase 4.2 — Category manager
- Create, edit, delete, hide and reorder categories (custom name, colour, icon and default picture); deleting moves events to a category you choose.
- IndexedDB schema v2 (`categories` store); backups include custom categories. Service worker cache v7.

## Phase 4.1 — Backup, import and export (0.4.0)
- Export all events, photos and key preferences to a versioned JSON file; last-backup date in Settings.
- Import with preview, merge (newer wins, never deletes) or replace (typed confirmation + automatic safety backup).
- Imported files are strictly validated (size, version, events, photo type/size/ownership, preferences).
- Requests persistent browser storage and shows its status. Service worker cache v6.

## Phase 3 — Living scenes and richer analytics (0.3.0)
- Rolling countdown digits, one-time count-up of day totals and a confetti burst on the event day; all respect full / calm / off motion and system reduced motion.
- Two new animated scenes (deadline, holiday) and matching sample events.
- Stats rebuilt: Overview (KPIs, progress rings, category donut), Categories (donut + linked bars), Calendar (events per month, year heatmap, year switcher). Every chart has a text summary and a data-table fallback.
- Pure analytics module with unit tests.

## Phase 2.1 — Navigation, density and calendar views (0.2.1)
- Sidebar replaced by a sticky top navigation bar with accessible dropdown menus (Calendar views, Timeline filters, Explore, Preferences with language and theme). Mobile keeps the bottom bar.
- Everything is calmer and less zoomed in: 14px base type, tighter cards, hero, KPI row and controls on desktop and mobile.
- Calendar: working Month, Week, Day and Agenda views; recurring events appear in every period (not only their next occurrence); drill from a week day into the day view; add an event on a chosen day.
- Timeline reads ?f= (all / upcoming / past / archived) from the menu.
- docs/DATA_AND_SYNC.md: how data is stored today, what multi-device sync needs, and the recommended backend decision for the final phase.

## Phase 2 — Event management, date engine and persistence (0.2.0)
- Create, edit, duplicate, favorite, archive and delete (with confirmation and Undo) your own events; samples stay read-only and can be copied.
- Fields: title, emoji, date, all-day or time (+ optional IANA zone), start date, category, scene, location, description, notes, recurrence.
- Recurrence engine: daily / weekly / monthly / yearly with intervals and end date; documented Feb 29 and month-end policy; skip or override single occurrences; recurring events show next occurrence plus last one as a memory.
- Precise live countdown (days, hours, minutes, seconds) to the real start instant.
- IndexedDB store with versioned migrations, record repair, in-memory fallback, Blob photo storage, cross-tab live sync.
- Timeline: sort, category filter, favorites, archived tab, search by title/description/location/category.
- Complete EN/MK strings and accessible validation. 119 tests.

## Phase 1 follow-up — scene motion and live countdown
- Fixed: CSS animation overrode the SVG `transform` attribute, so the tooth, laptop and plane jumped to the corner. Animated groups are now wrapped.
- Every scene is animated with its own motion (car wheels spin and headlight glows, tooth bounces and blinks, laptop types, sailboat and gulls, birds and pulsing sun, etc.).
- 7 new scenes (concert, house, runner, graduation, rocket, wedding, fireworks) so sample events no longer repeat the same art; EN/MK labels added.
- Live "3d 14h 22m" countdown (days, hours, minutes to local midnight) on cards, hero and detail; refreshes every 15 s.

## Phase 1 — PWA foundation and design system (0.1.0)

- Installable offline-first PWA shell (manifest, icons, versioned service worker, update flow).
- Design tokens, dark/light/auto themes, 7 accents with AA-safe ink.
- Responsive desktop sidebar / tablet rail / mobile bottom navigation.
- Home, Calendar (month), Timeline, Stats, Categories, Memories, Event detail, Settings views.
- English + Macedonian i18n with bundled Macedonian dates and plural rules.
- Labeled sample events; honest "Soon" placeholders for later-phase features.
- Unit tests (dates, i18n, data, project integrity) and 24 browser E2E tests (routes x 5 viewports, offline, a11y, contrast, keyboard, themes, languages).
