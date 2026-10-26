# Phase 2 report — event management, date engine and persistence

## Delivered
- Real event CRUD (create, edit, duplicate, favorite, archive/unarchive, delete with Undo) backed by IndexedDB; data survives refresh and an offline restart.
- Recurrence engine and instant/zone model (policies in [PRODUCT_SPEC.md](PRODUCT_SPEC.md)); per-occurrence skip and title/notes override.
- Live countdown with seconds; recurring and past-event states; hero prefers favorites.
- Timeline search, sort, category and favorites filters, archived view; accurate counts (a recurring series counts once).
- Schema v1 with migration path (`migrateRecord`, `MIGRATIONS`), corrupted-record quarantine, memory fallback with a visible notice, BroadcastChannel live sync, local photo Blobs.
- All new UI strings in English and Macedonian.

## Tests
119 passing: unit (recurrence, instants, model, store with injected storage), and browser E2E in headless Edge using real IndexedDB. See [TEST_PLAN.md](TEST_PLAN.md).

## Issues found and fixed
- Zone conversion in a spring-forward gap returned a time before the gap; now resolved after it.
- Brute-force recurrence cross-check exposed nothing in the engine; two test expectations were wrong and corrected.
- Toggle rows rendered as a centered column (CSS specificity); fixed.

## Known limits / not verified
- Calendar and Timeline show each recurring series' next occurrence + last past one, not every future occurrence (Phase 4 adds full expansion).
- Reminders, sharing, backup/export, custom categories are later phases (buttons are disabled and say so).
- Real devices, screen readers, quota-exceeded behavior and a native Macedonian review are not verified.
- Photos are stored as originals (≤8 MB each); thumbnails/downscaling is a later optimization.
