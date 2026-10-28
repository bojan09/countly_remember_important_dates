# Where data lives, and how multiple devices could share it

> **Decision (product owner): local-only.** Countly stays server-free: no accounts, no cloud database, no sync. Data lives on the device; the **backup file** (Settings → Export / Import Data) is the way to move or protect it. Consequences, accepted:
> - Each device has its own copy; moving to a new phone means export → import.
> - Clearing site data or uninstalling deletes events. Mitigations built: persistent-storage request, a Home reminder to back up (shown with 3+ events and no backup in 30 days, snoozable 14 days), a safety backup before any "Replace" import.
> - Reminders only fire while the app is open; the `.ics` calendar export is the dependable alternative ([REMINDERS.md](REMINDERS.md)).
> - The backup format (`version`, per-event `updatedAt`) is kept stable so sync can be added later without migrating user data. The rest of this page is the analysis behind the decision and stays valid if it is revisited.

## Today (Phase 2.1): local-first, no server

- All events, preferences and photos are stored **on the device, in the browser's IndexedDB** (events, photos as Blobs) plus a few UI flags in localStorage. It is a real database built into every browser: no install, no account, works offline, nothing is uploaded.
- Consequence: **each browser profile on each device has its own copy.** Phone and laptop do not see each other's events. Clearing site data or uninstalling the app deletes the data (browsers can also evict storage under heavy disk pressure unless the app is installed or granted persistent storage).

## Can two phones share data *without* any database or server?

Only partly, and always with a manual or peer-to-peer step:

| Option | Needs a server? | Real-time? | Verdict |
|---|---|---|---|
| **Export / import a backup file** (JSON, optionally with photos) | No | No | Built in Phase 4.1. Simple, private, works everywhere. Good as the safety net regardless of anything else. |
| **Share via link or QR code** (event encoded in the URL / QR) | No | No | Good for sending one event or one countdown to someone, not for keeping devices in sync. |
| **Peer-to-peer sync (WebRTC)** | A tiny signalling step (QR/code) to pair; no data stored on a server | Only while both devices are online | Possible, but fiddly (pairing, NAT/firewalls, conflict handling). Not worth it for v1. |
| **Cloud-drive file sync** (File System Access API / user's own Drive/Dropbox) | The user's own storage | Eventually | Browser support is uneven (iOS Safari has none). |

So: *true* automatic multi-device sync cannot be done with no server at all. Something has to hold the data between devices.

## Recommended server option (decide in the final phase)

Keep **IndexedDB as the source of truth on every device** (the app stays fully offline-first and usable without an account) and add an **optional account + sync** layer:

1. **Supabase (recommended)** — Postgres + Auth + Row Level Security + Realtime + Storage (photos) with a generous free tier, standard SQL, and open source (can be self-hosted later). Fits this app's model: one `events` table (+ `occurrences overrides`, `photos` in Storage), each row owned by `auth.uid()`. This is also the stack already used in the author's other projects.
2. Appwrite Cloud — comparable (database + auth + storage + realtime), also free tier.
3. Firebase/Firestore — works well offline natively, but is proprietary and harder to leave.
4. PocketBase (self-hosted SQLite binary) — cheapest and simplest if you are happy to run one tiny server.

### How sync would work (design sketch)

- Each event already has a stable `id`, `createdAt`, `updatedAt` and a `schema` version, which is what a sync layer needs.
- Writes go to IndexedDB first (instant, offline), then are pushed to the server in the background; remote changes are pulled and merged by **last-writer-wins per event using `updatedAt`** (deletes use tombstones). Per-field merging is unnecessary for this data.
- Photos upload to object storage and are fetched lazily; thumbnails kept locally.
- Sign-in: email magic link or passkey. The app must stay fully usable **signed out** (current behaviour).
- Optional: end-to-end encryption of notes/titles before upload, so even the server operator cannot read them (trade-off: no server-side search/reminders).
- Reminders: "no-backend" reminders only fire while the app/browser is open. Push notifications while closed need a server (Web Push) — another reason to add the backend in the final phase.

### Decision needed from the product owner (final phase)
1. Is account-based sync wanted at all, or is "export/import + share links" enough?
2. If yes: Supabase (recommended) vs. another provider.
3. Privacy stance: plain server-side storage vs. end-to-end encrypted.

Until then the app deliberately promises only what is true: *your data stays on this device.*
