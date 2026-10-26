// Service worker registration, install prompt and connectivity notices.
import { toast } from './components/ui.js';
import { t } from './i18n/index.js';

let deferredPrompt = null;
let registration = null;
let waiting = null;

export const pwa = {
  offlineReady: () => 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
  isInstalled: () => (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
  canInstall: () => !!deferredPrompt,
  async install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
    }
  },
  updateAvailable: () => !!waiting,
  applyUpdate() {
    if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  },
};

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
  window.addEventListener('online', () => toast(t('toast.online')));
  window.addEventListener('offline', () => toast(t('toast.wentOffline')));

  if (!('serviceWorker' in navigator)) return;
  // Service workers need a secure context (https or localhost).
  if (!window.isSecureContext) return;

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloading) {
      reloading = true;
      location.reload();
    }
  });

  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      registration = reg;
      const watched = new WeakSet();
      const watch = (worker) => {
        if (watched.has(worker)) return;
        watched.add(worker);
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed') return;
          if (navigator.serviceWorker.controller) {
            waiting = worker;
            toast(t('pwa.updateReady'), { timeout: 6000 });
          } else {
            toast(t('toast.offlineReady'));
          }
        });
      };
      if (reg.installing) watch(reg.installing);
      if (reg.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
      reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    })
    .catch(() => {
      /* registration failure leaves the app fully usable online */
    });
}

export function checkForUpdate() {
  if (registration) registration.update().catch(() => {});
}
