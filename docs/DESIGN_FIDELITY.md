# Design fidelity

Reference: [design/COUNTLY_APPROVED_DESIGN.png](design/COUNTLY_APPROVED_DESIGN.png). Screenshots in [screenshots/](screenshots/) are produced by `node tools/shots.mjs` (headless Edge, 1x/2x). Statuses are from visual comparison of those screenshots, not pixel diffing.

| Reference screen | Status (Phase 1) | Notes / justified deviations |
|---|---|---|
| Desktop dashboard (sidebar, greeting, search, bell, Add Event, 4 KPIs, hero, mini calendar, tiles) | Matches structure, palette, hierarchy | Hero art is authored SVG, simpler than the reference's rendered 3D scene (Phase 3 art pass). "Today" heading is "Up next" because the tiles are not today's events. No red bell dot (no reminders exist). Language buttons and sun/moon toggle in the sidebar footer as in the reference. |
| Mobile dashboard (header, Upcoming / This Month / Past with counts, wide cards, FAB, bottom nav) | Matches | Sample-data banner added (required by the spec's disclosure rule). Cards: text left, art right; dental card mirrored like the reference. |
| Event detail | Matches layout (hero art, tinted sheet, big days, progress, 4 action circles, notes, photos) | Actions are disabled until Phase 2/5 and say so. Progress is computed truthfully (reference showed inconsistent 88% / 11 of 365). |
| Add event | Not built (Phase 2); honest placeholder | |
| Theme picker | Not built (Phase 2/3) | |
| Calendar | Month view matches (pill today, category dots, "Events on" paper sheet) | Week/Agenda tabs disabled until Phase 4. Weekend tint removed to match the mini calendar. |
| Timeline | Matches (blue "All" tab, dated rail with category dots, thumbnail cards) | "All" lists upcoming first, then past. |
| Stats | Matches (pastel KPI tiles, donut + legend, monthly bars with peak tip) | Categories/Calendar sub-tabs disabled until Phase 3. Numbers come from the event data, not the mockup. |
| Share countdown | Not built (Phase 5) | |
| Settings | Matches (Appearance, Accent, Language with flags, rows) | Rows for later features show a "Soon" badge; PWA/Offline and About are functional. Added name, reduce-motion and sample toggles. |
| Brand (calendar-heart mark, tagline) | Original SVG mark in the same spirit | Not a raster crop. |

Typography uses the system sans stack (no font downloads; Cyrillic safe). Reference uses an Inter-like face.

Known remaining gaps: richer scene art and living animation (Phase 3); photographic polish of the hero; pixel-level spacing audit across all screens (Phase 6).
