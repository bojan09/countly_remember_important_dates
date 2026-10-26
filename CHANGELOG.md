# Changelog

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
