# Phase 4.3 report — memory notes and photos

## Delivered
- **Memory note** ("How was it?"): a private note (≤600 characters) on any of your events that has started or is in the past, saved per occurrence (a yearly birthday gets one note per year). Shown on the event page and as a snippet on the Memories page. A one-time event keeps its note if you only change its date; turning it into a series resets occurrence data, as before.
- **Photos**:
  - Large photos are downscaled on the device to 1600px JPEG (quality 0.85) before they are stored; photos already small (≤1600px and ≤600 KB) are stored untouched. EXIF rotation is applied. If the browser cannot decode a file the original is stored.
  - Accepted formats are exactly those a backup can carry: JPEG, PNG, WebP, GIF, AVIF. SVG, HEIC and others are refused with a message.
  - Tapping a thumbnail opens a viewer: previous/next buttons and arrow keys, "Photo 2 of 5: name" caption, remove with confirmation, Escape closes, focus stays inside.
  - Thumbnails keep their stored order even though images load asynchronously.
- **Memories page**: filter (All / With photos / With notes, each with a count), grouped by year, newest first. Cards show your first photo (or the scene art), the note, and the photo count.
- Backups already carry notes (inside the event record) and photos; both are covered by tests. Service worker cache v8.

## Tests
177 total (+6 unit tests in `tests/memories.test.js`, +5 browser tests in `tests/e2e.memories.test.js`: note save/reload/Memories, no note box on upcoming events, 3200px image stored as 1600×900 JPEG and small image untouched, viewer keyboard navigation and delete, SVG refused, Macedonian on a 360px phone). One older browser test updated for the new photo-type message.

## Not verified / limits
- Photo compression was exercised with generated gradient images in headless Chromium, not real camera photos; HEIC from iPhones is not accepted (iOS usually converts to JPEG when picking from the library, but I could not test that).
- Photos belong to the event series, not to a single occurrence.
- Samples have no notes or photos of their own beyond the demo art.
- Whole-library storage use is not capped beyond 12 photos per event; Settings → PWA / Offline shows total usage.
