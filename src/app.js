import { loadPrefs, getPrefs, setPref as storeSetPref, applyPrefs, onPrefChange } from './store/prefs.js';
import { setLang, getLang, t, LANGS } from './i18n/index.js';
import { todayISO } from './date/calendar.js';
import { tickLive } from './components/eventCard.js';
import { getEvents, getEvent, initStore, onStoreChange, storeStatus } from './store/events.js';
import { h, openModal, toast } from './components/ui.js';
import { icon, flagSvg } from './components/icons.js';
import { logoMark } from './components/logo.js';
import { initPwa, pwa } from './pwa.js';

const ROUTES = {
  '': { name: 'home', load: () => import('./views/home.js'), title: 'nav.home' },
  calendar: { name: 'calendar', load: () => import('./views/calendar.js'), title: 'nav.calendar' },
  timeline: { name: 'timeline', load: () => import('./views/timeline.js'), title: 'nav.timeline' },
  stats: { name: 'stats', load: () => import('./views/stats.js'), title: 'nav.stats' },
  categories: { name: 'categories', load: () => import('./views/categories.js'), title: 'nav.categories' },
  memories: { name: 'memories', load: () => import('./views/memories.js'), title: 'nav.memories' },
  settings: { name: 'settings', load: () => import('./views/settings.js'), title: 'nav.settings' },
  new: { name: 'new', load: () => import('./views/create.js'), title: 'create.title' },
  edit: { name: 'edit', load: () => import('./views/create.js'), title: 'create.editTitle' },
  event: { name: 'event', load: () => import('./views/detail.js'), title: 'nav.home' },
};

const NAV = [
  ['', 'home', 'nav.home'],
  ['calendar', 'calendar', 'nav.calendar'],
  ['timeline', 'timeline', 'nav.timeline'],
  ['stats', 'stats', 'nav.stats'],
  ['categories', 'categories', 'nav.categories'],
  ['memories', 'memories', 'nav.memories'],
  ['settings', 'settings', 'nav.settings'],
];

const app = document.getElementById('app');
let viewHost = null;
let current = { name: 'home', key: '' };
let renderToken = 0;
let enteredViaApp = false;
let observer = null;

/* ---------- context handed to every view ---------- */
function makeCtx(query = new URLSearchParams()) {
  const today = todayISO();
  return {
    today,
    events: getEvents(today),
    prefs: getPrefs(),
    query,
    pwa,
    getEvent: (id) => getEvent(id, today),
    navigate: (hash) => {
      location.hash = hash;
    },
    goBack,
    setPref,
    setLang: changeLanguage,
    openNotifications,
  };
}

function goBack() {
  if (enteredViaApp && history.length > 1) history.back();
  else location.hash = '#/';
}

function setPref(key, value, { silent = false } = {}) {
  storeSetPref(key, value);
  if (key === 'theme' || key === 'accent' || key === 'reduceMotion') applyPrefs();
  if (key === 'theme') toast(t('toast.theme'));
  if (key === 'accent') toast(t('toast.accent'));
  if (key === 'showSamples') toast(value ? t('toast.samplesShown') : t('toast.samplesHidden'));
  syncThemeToggle();
  if (!silent) renderRoute({ keepScroll: true });
}

function changeLanguage(lang) {
  if (lang === getLang()) return;
  setLang(lang);
  storeSetPref('lang', lang);
  mountShell();
  renderRoute({ keepScroll: true });
  toast(t('toast.language'));
}

/* ---------- shell ---------- */
function mountShell() {
  const prefs = getPrefs();
  document.title = `${t('app.name')} — ${t('app.tagline')}`;

  const skip = h('a', { class: 'skip-link', href: '#main', onclick: (e) => { e.preventDefault(); document.getElementById('main').focus(); } }, t('app.skip'));

  const navLinks = NAV.map(([path, ic, label]) =>
    h('a', { class: 'nav-link', href: `#/${path}`, 'data-route': ROUTES[path].name, 'aria-label': t(label) }, h('span', { html: icon(ic, { size: 22 }) }), h('span', { class: 'lbl' }, t(label))),
  );

  const langButtons = Object.entries(LANGS).map(([id, l]) =>
    h('button', { type: 'button', class: 'lang-btn', lang: id, 'aria-pressed': String(getLang() === id), 'aria-label': l.label, onclick: () => changeLanguage(id) }, h('span', { html: flagSvg(id) }), h('span', { class: 'lbl' }, l.label)),
  );

  const themeToggle = h(
    'div',
    { class: 'theme-toggle', role: 'group', 'aria-label': t('settings.appearance') },
    h('button', { type: 'button', 'data-theme-btn': 'light', 'aria-label': t('settings.light'), onclick: () => setPref('theme', 'light'), html: icon('sun', { size: 20 }) }),
    h('button', { type: 'button', 'data-theme-btn': 'dark', 'aria-label': t('settings.dark'), onclick: () => setPref('theme', 'dark'), html: icon('moon', { size: 20 }) }),
  );

  const collapseBtn = h(
    'button',
    { type: 'button', class: 'collapse-btn', 'aria-label': t('actions.toggleSidebar'), onclick: () => { setPref('sidebarCollapsed', !getPrefs().sidebarCollapsed, { silent: true }); document.querySelector('.shell').classList.toggle('collapsed', getPrefs().sidebarCollapsed); } },
    h('span', { html: icon('menu', { size: 20 }) }),
    h('span', { class: 'lbl' }, t('actions.toggleSidebar').split(' ')[0]),
  );

  const sidebar = h(
    'aside',
    { class: 'sidebar' },
    h('a', { class: 'brand', href: '#/', 'aria-label': `${t('app.name')} — ${t('nav.home')}` }, h('span', { html: logoMark(40) }), h('span', { class: 'brand-name' }, t('app.name'))),
    h('nav', { class: 'nav', 'aria-label': t('nav.main') }, navLinks),
    h('div', { class: 'side-foot' }, langButtons, themeToggle, collapseBtn),
  );

  viewHost = h('div', { class: 'main-inner', id: 'view' });
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' }, viewHost);

  const bn = (path, ic, label) => h('a', { class: 'bn-link', href: `#/${path}`, 'data-route': ROUTES[path].name }, h('span', { html: icon(ic, { size: 24 }) }), h('span', null, t(label)));
  const bottomNav = h(
    'nav',
    { class: 'bottom-nav', 'aria-label': t('nav.mobile') },
    bn('', 'home', 'nav.home'),
    bn('calendar', 'calendar', 'nav.calendar'),
    h('a', { class: 'fab', href: '#/new', 'aria-label': t('actions.addEvent'), html: icon('plus', { size: 30 }) }),
    bn('stats', 'stats', 'nav.stats'),
    h('button', { type: 'button', class: 'bn-link', 'data-route': 'more', 'aria-haspopup': 'dialog', onclick: openMore }, h('span', { html: icon('more', { size: 24 }) }), h('span', null, t('nav.more'))),
  );

  const shell = h('div', { class: `shell${prefs.sidebarCollapsed ? ' collapsed' : ''}`, 'data-route': current.name }, sidebar, main, bottomNav);
  app.replaceChildren(skip, shell);
  syncThemeToggle();
  markActive();
}

function syncThemeToggle() {
  const resolved = document.documentElement.dataset.theme;
  document.querySelectorAll('[data-theme-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeBtn === resolved)));
}

function markActive() {
  const shell = document.querySelector('.shell');
  if (shell) shell.dataset.route = current.name;
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.classList.contains('shell')) return;
    const on = a.dataset.route === current.name || (['event', 'edit', 'new'].includes(current.name) && a.dataset.route === 'home') || (['timeline', 'categories', 'memories', 'settings'].includes(current.name) && a.dataset.route === 'more');
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function openMore() {
  const items = [
    ['timeline', 'timeline', 'nav.timeline'],
    ['categories', 'categories', 'nav.categories'],
    ['memories', 'memories', 'nav.memories'],
    ['settings', 'settings', 'nav.settings'],
  ];
  let modal;
  const list = h(
    'ul',
    { class: 'more-list' },
    items.map(([path, ic, label]) => h('li', null, h('a', { class: 'row more-row', href: `#/${path}`, onclick: () => modal.close() }, h('span', { class: 'row-ico', html: icon(ic, { size: 22 }) }), h('span', { class: 'grow' }, t(label)), h('span', { html: icon('chevronRight', { size: 20 }) })))),
  );
  modal = openModal({ title: t('nav.moreMenu'), content: list, variant: 'sheet' });
}

function openNotifications() {
  openModal({
    title: t('notify.title'),
    content: h('div', { class: 'notify-empty' }, h('p', { class: 'empty-title' }, t('notify.emptyTitle')), h('p', null, t('notify.body'))),
    actions: [{ label: t('actions.gotIt') }],
  });
}

/* ---------- onboarding ---------- */
function showOnboarding() {
  const prefs = getPrefs();
  let samples = prefs.showSamples;
  let name = prefs.name;
  let finished = false;
  const nameInput = h('input', { type: 'text', class: 'input', id: 'ob-name', maxlength: '40', value: name, autocomplete: 'given-name' });
  nameInput.addEventListener('input', () => (name = nameInput.value.trim()));
  const sampleBtn = h('button', { type: 'button', id: 'ob-samples', class: 'switch', role: 'switch', 'aria-checked': String(samples), 'aria-labelledby': 'ob-samples-l' });
  sampleBtn.addEventListener('click', () => {
    samples = !samples;
    sampleBtn.setAttribute('aria-checked', String(samples));
  });

  const langRow = h('div', { class: 'ob-row', role: 'radiogroup', 'aria-label': t('onboarding.language') },
    Object.entries(LANGS).map(([id, l]) =>
      h('button', { type: 'button', class: 'ob-chip', role: 'radio', lang: id, 'aria-checked': String(getLang() === id), onclick: () => { storeSetPref('name', name); storeSetPref('showSamples', samples); changeLanguage(id); finished = false; modal.dialog.dataset.reopen = '1'; modal.close(); } }, h('span', { html: flagSvg(id) }), l.label),
    ),
  );
  const themeRow = h('div', { class: 'ob-row', role: 'radiogroup', 'aria-label': t('onboarding.theme') },
    [['light', 'sun', 'settings.light'], ['dark', 'moon', 'settings.dark'], ['auto', 'auto', 'settings.auto']].map(([id, ic, label]) =>
      h('button', { type: 'button', class: 'ob-chip', role: 'radio', 'aria-checked': String(getPrefs().theme === id), onclick: (e) => { setPref('theme', id, { silent: true }); themeRow.querySelectorAll('[role=radio]').forEach((b) => b.setAttribute('aria-checked', 'false')); e.currentTarget.setAttribute('aria-checked', 'true'); } }, h('span', { html: icon(ic, { size: 18 }) }), t(label)),
    ),
  );

  const content = h(
    'div',
    { class: 'ob' },
    h('p', null, t('onboarding.body')),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('onboarding.language')), langRow),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('onboarding.theme')), themeRow),
    h('div', { class: 'field' }, h('label', { for: 'ob-name' }, t('onboarding.name')), nameInput),
    h('div', { class: 'toggle-row' }, h('div', { class: 'grow' }, h('label', { id: 'ob-samples-l', for: 'ob-samples' }, t('onboarding.samples')), h('small', { class: 'muted' }, t('onboarding.samplesHelp'))), sampleBtn),
  );

  const modal = openModal({
    title: t('onboarding.title'),
    content,
    variant: 'onboarding',
    actions: [{ label: t('actions.getStarted'), onClick: (close) => { finished = true; close(); } }],
    onClose: () => {
      const reopen = modal.dialog.dataset.reopen === '1';
      if (reopen) {
        showOnboarding();
        return;
      }
      storeSetPref('name', name);
      storeSetPref('showSamples', samples);
      storeSetPref('onboarded', true);
      renderRoute({ keepScroll: true });
    },
  });
}

/* ---------- routing ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  const first = segs[0] || '';
  return { first, arg: segs[1] ? decodeURIComponent(segs[1]) : null, query: new URLSearchParams(queryPart), key: raw };
}

async function renderRoute({ keepScroll = false, routeChange = false } = {}) {
  const token = ++renderToken;
  const { first, arg, query, key } = parseHash();
  const route = ROUTES[first] || ROUTES[''];
  current = { name: route.name, key };
  markActive();
  const ctx = makeCtx(query);
  const scrollY = window.scrollY;
  try {
    const mod = await route.load();
    if (token !== renderToken) return; // a newer navigation superseded this one
    const el = mod.default(ctx, arg);
    viewHost.replaceChildren(el);
    document.title = `${t(route.title)} — ${t('app.name')}`;
    watchScenes();
    if (routeChange) {
      window.scrollTo(0, 0);
      document.getElementById('main').focus({ preventScroll: true });
    } else if (keepScroll) {
      window.scrollTo(0, scrollY);
    }
  } catch (err) {
    console.error(err);
    if (token !== renderToken) return;
    viewHost.replaceChildren(h('div', { class: 'empty', role: 'alert' }, h('h2', { class: 'empty-title' }, t('errors.viewFailed')), h('button', { type: 'button', class: 'btn primary', onclick: () => renderRoute() }, t('errors.retry'))));
  }
}

/* ---------- performance: pause scene animation when offscreen / tab hidden ---------- */
function watchScenes() {
  if (!('IntersectionObserver' in window)) return;
  observer && observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.target.classList.toggle('scene-paused', !en.isIntersecting)),
    { rootMargin: '80px' },
  );
  viewHost.querySelectorAll('.scene-art').forEach((s) => observer.observe(s));
}

document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('page-hidden', document.hidden);
  if (!document.hidden) checkDayChange();
});

/* ---------- shared clock: keep "today" correct across midnight, sleep and wake ---------- */
let lastToday = todayISO();
function checkDayChange() {
  const now = todayISO();
  if (now !== lastToday) {
    lastToday = now;
    renderRoute({ keepScroll: true });
  }
}
setInterval(() => {
  if (document.hidden) return;
  checkDayChange();
  tickLive();
}, 1000);
window.addEventListener('focus', checkDayChange);

/* ---------- boot ---------- */
async function boot() {
  const prefs = loadPrefs();
  setLang(prefs.lang, { silent: true });
  applyPrefs();
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (getPrefs().theme === 'auto') {
      applyPrefs();
      syncThemeToggle();
    }
  });
  onPrefChange(() => {});
  await initStore();
  // Live updates: a save in this tab or another tab refreshes the visible list. Forms are left alone.
  onStoreChange(() => {
    if (current.name === 'new' || current.name === 'edit') return;
    renderRoute({ keepScroll: true });
  });
  mountShell();
  window.addEventListener('hashchange', () => {
    enteredViaApp = true;
    renderRoute({ routeChange: true });
  });
  renderRoute();
  initPwa();
  if (!prefs.onboarded) showOnboarding();
  if (!storeStatus.persistent) toast(t('toast.storageMemory'), { timeout: 8000 });
  if (storeStatus.skipped) toast(t('toast.loadSkipped', { count: storeStatus.skipped }), { timeout: 6000 });
}

boot();
