# Phase 4.1 report — backup, import and export

## Delivered
- **Export** (Settings → Your data → Export Data): one JSON file, `countly-backup-YYYY-MM-DD.json`, with all your events (including skips and per-occurrence overrides), photos (base64) and language/theme/accent/motion/name/sample-toggle. Sample events are not exported. The last backup date is shown on the row; a never-backed-up state says the data only exists on this device.
- **Import** (Import Data): pick a file → validated → preview dialog with counts → choose a mode.
  - **Merge** (default): adds new events, updates only those whose `updatedAt` is newer in the file, adds missing photos (respecting the 12-per-event cap). Never deletes. Repeating the same import changes nothing.
  - **Replace**: requires typing REPLACE (ЗАМЕНИ in Macedonian), downloads a safety backup first (aborts if that fails), writes the file's data and only then removes what is not in it.
  - Optional: also restore language, theme and name.
- **Persistent storage**: the app asks the browser not to evict its data; Settings → PWA/Offline shows whether it was granted and says to export a backup when it was not.
- **File format** (`format: "countly-backup"`, `version: 1`) is versioned and carries `updatedAt` on every event, so it can later double as the sync payload.

## Safety rules for imported files (all unit tested)
- Files over 100 MB, non-JSON, wrong `format`, or `version` newer than the app are refused with a specific message; nothing is written.
- Every event passes the same repair/validation as a stored record; unknown fields are dropped, text is clamped, bad dates/ids are skipped and counted, `__proto__`-style keys never reach an object.
- Photos must be raster images (JPEG, PNG, WebP, GIF, AVIF; SVG is refused), valid base64, within the 8 MB cap, belong to an event in the file, and have unique ids.
- Preferences go through the normal sanitizer; `onboarded` and `lastBackup` are never imported.
- Duplicate event ids in one file keep the newest.

## Tests
149 total (+10 unit tests in `tests/backup.test.js`, +5 browser tests in `tests/e2e.backup.test.js`: export toast and date, merge round trip and idempotence, replace with typed confirmation, bad files, Macedonian on a 390px phone). Also made the onboarding browser test wait for the reopened dialog; it raced under load.

## Not verified / limits
- Merge cannot propagate deletions (no tombstones yet); that belongs with sync.
- Whole file is read into memory: fine up to the 100 MB cap, not streamed.
- The download goes through the browser's normal download flow; behaviour on iOS Safari (share sheet vs. Files) was not tested on a real device.
- Backups are plain text: anyone with the file can read it. Encryption is not part of v1.
- Persistence is a request; browsers may decline.
