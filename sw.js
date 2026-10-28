// Countly service worker: precaches the app shell for offline use.
// Bump VERSION whenever any precached file changes (tests/sw.test.js verifies the list is complete).
const VERSION = 'countly-shell-v14';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon.svg',
  './assets/icons/maskable-512.png',
  './assets/icons/mono.svg',
  './src/app.js',
  './src/boot.js',
  './src/pwa.js',
  './src/version.js',
  './src/components/calendarGrid.js',
  './src/components/chunked.js',
  './src/components/charts.js',
  './src/components/milestone.js',
  './src/components/photos.js',
  './src/components/reminders.js',
  './src/components/roll.js',
  './src/components/shareStudio.js',
  './src/components/chrome.js',
  './src/components/eventCard.js',
  './src/components/icons.js',
  './src/components/logo.js',
  './src/components/miniCalendar.js',
  './src/components/navbar.js',
  './src/components/ui.js',
  './src/date/calendar.js',
  './src/date/instant.js',
  './src/date/recurrence.js',
  './src/events/analytics.js',
  './src/events/ics.js',
  './src/events/milestones.js',
  './src/events/reminders.js',
  './src/events/shareCard.js',
  './src/events/categories.js',
  './src/events/format.js',
  './src/events/model.js',
  './src/events/select.js',
  './src/i18n/en.js',
  './src/i18n/index.js',
  './src/i18n/mk-dates.js',
  './src/i18n/mk.js',
  './src/scenes/art.js',
  './src/store/backup.js',
  './src/store/db.js',
  './src/store/demo.js',
  './src/store/events.js',
  './src/store/prefs.js',
  './src/styles/base.css',
  './src/styles/components.css',
  './src/styles/extras.css',
  './src/styles/layout.css',
  './src/styles/tokens.css',
  './src/styles/views.css',
  './src/views/backupFlow.js',
  './src/views/calendar.js',
  './src/views/categories.js',
  './src/views/create.js',
  './src/views/detail.js',
  './src/views/home.js',
  './src/views/memories.js',
  './src/views/settings.js',
  './src/views/stats.js',
  './src/views/timeline.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('countly-') && k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Tapping a reminder notification opens (or focuses) the app on that event.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.hash) || '#/';
  const target = new URL(self.registration.scope);
  target.hash = hash.replace(/^#/, '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(target.href).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch third-party requests
  if (url.pathname.endsWith('/sw.js')) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      } catch {
        if (req.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
      }
    })(),
  );
});
