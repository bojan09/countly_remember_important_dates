# Phase 2.1 report — navigation, density and calendar views

Feedback after Phase 2: the app felt too zoomed in on desktop and mobile, a top bar with dropdowns was preferred over a sidebar, and the calendar could not switch to week/day. Data-sync questions are answered in [DATA_AND_SYNC.md](DATA_AND_SYNC.md).

## Delivered
- **Top navigation** (≥768px): brand, Home, Calendar ▾ (Month/Week/Day/Agenda), Timeline ▾ (All/Upcoming/Past/Archived), Explore ▾ (Stats/Categories/Memories), search, notifications, Add Event, Preferences ▾ (Settings, language, theme). Dropdowns: `aria-haspopup/expanded`, arrow/Home/End/Escape keys, focus returns to the trigger, one open at a time, outside click closes. Tablet shows icons only. Mobile keeps the bottom bar.
- **Zoomed out**: 14px root type, smaller radii, KPI/hero/card/button sizes, narrower content column. Desktop: the first row of "Up next" tiles is visible at 1440×900; mobile: two cards fit on a 390×844 screen.
- **Calendar**: Month/Week/Day/Agenda all enabled; recurring events expand into every visible period (`getOccurrencesBetween`, bounded at 400 per series); week days drill into Day; "Add an event on this day".
- Timeline `?f=` filter, richer menus wiring.

## Tests
127 passing (8 new browser tests for navigation/calendar/density). See [TEST_PLAN.md](TEST_PLAN.md).

## Issues found and fixed
- New "Add an event" link had 1.5-2.7:1 contrast on the light day sheet for several accents (caught by the accent×theme contrast test); now uses the paper text colour.
- Service-worker precache list updated and cache bumped to v4 (stale cache previously hid updates).

## Not verified / limits
- Visual check by eye plus automated assertions only; no real devices or screen readers.
- Scene art scale was not changed; the hero art is cropped (max 232px) rather than redrawn.
- Day view is a grouped list (all-day, then timed), not an hour-by-hour grid; an hourly grid can follow in Phase 4 if wanted.
