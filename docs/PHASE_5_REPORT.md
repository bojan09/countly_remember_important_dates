# Phase 5 report — reminders, calendar export and share image studio

Scope decision: no database or sync in this phase; everything stays in on-device storage.

## Delivered
- **Reminders** (per event, form and detail dialog): at time / 1 hour before / 1 day / 2 days / 1 week. Fired reminders show a dot on the bell and an inbox with a "Coming up" list and "Mark all as read"; with permission they also become system notifications. Settings → Notifications explains permission and limits plainly. See [REMINDERS.md](REMINDERS.md).
- **Calendar export (.ics)** for one event or all events, with repeat rules, skipped dates and alarms. This is the only way to get alerts while Countly is closed without a server.
- **Share image studio** (event page → Share): Story 1080×1920, Square 1080×1080, Wide 1200×630; Night, Day or Vivid look; switches for title, date and picture. Drawn on a canvas on the device, downloaded as PNG or sent through the system share sheet when the browser supports sharing files; "Copy text" as a fallback. Long titles wrap, then shrink the whole text block to stay clear of the footer. Nothing is uploaded.
- Notification clicks open the event (service worker). Cache v11.

## Tests
222 total (+32): reminders and .ics unit tests (DST, window rules, folding, alarms, recurrence), share layout unit tests (wrapping, contrast of all three looks, crop maths), and browser tests for the bell inbox, system notifications (stubbed), reminder dialog and form, .ics contents, and rendering/downloading real PNGs in all sizes, EN and MK on a phone. The contrast test caught the original "Vivid" look (white on pink 2.8:1); its gradient was darkened to ≥5:1.
Also hardened an import browser test that failed once under full-suite load.

## Not verified / limits
- Real system notifications were not seen on a device; the browser tests stub the notification API.
- iOS Safari behaviour (installed-only notifications, share sheet for files) was not tested.
- `.ics` import into specific calendar apps (Google, Apple, Outlook) was not tested; the file follows RFC 5545 structure but wasn't run through an external validator.
- Canvas text uses the app's font stack; emoji and non-Latin scripts depend on fonts on the device.
- Sample events can export/share but cannot hold reminders.
