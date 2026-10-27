import { h, openModal } from '../components/ui.js';
import { icon, flagSvg } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { ACCENTS } from '../store/prefs.js';
import { LANGS, t, getLang, formatDate } from '../i18n/index.js';
import { runExport, pickAndImport } from './backupFlow.js';
import { openNotificationSettings, exportAllToCalendar } from '../components/reminders.js';

const SOON_ROWS = [];

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function renderSettings(ctx) {
  const { prefs } = ctx;
  const root = h('div', { class: 'view settings' }, pageHeader(ctx, { title: t('settings.title') }), mobilePageHead(ctx, t('settings.title')));
  const panel = h('div', { class: 'paper set-panel' });

  // Appearance
  const themes = [
    ['light', 'sun', t('settings.light')],
    ['dark', 'moon', t('settings.dark')],
    ['auto', 'auto', t('settings.auto')],
  ];
  panel.append(
    h('h2', { class: 'set-h' }, t('settings.appearance')),
    h(
      'div',
      { class: 'theme-opts', role: 'radiogroup', 'aria-label': t('settings.appearance') },
      themes.map(([id, ic, label]) =>
        h('button', { type: 'button', class: 'theme-opt', role: 'radio', 'aria-checked': String(prefs.theme === id), onclick: () => ctx.setPref('theme', id) }, h('span', { html: icon(ic, { size: 26 }) }), h('span', null, label)),
      ),
    ),
    h('h2', { class: 'set-h' }, t('settings.accent')),
    h(
      'div',
      { class: 'accents', role: 'radiogroup', 'aria-label': t('settings.accent') },
      Object.entries(ACCENTS).map(([id, color]) =>
        h('button', { type: 'button', class: 'accent-dot', role: 'radio', 'aria-checked': String(prefs.accent === id), 'aria-label': t(`settings.accents.${id}`), style: { '--c': color }, onclick: () => ctx.setPref('accent', id) }, prefs.accent === id ? h('span', { html: icon('check', { size: 18 }) }) : null),
      ),
    ),
    h('h2', { class: 'set-h' }, t('settings.language')),
    h(
      'div',
      { class: 'lang-list', role: 'radiogroup', 'aria-label': t('settings.language') },
      Object.entries(LANGS).map(([id, l]) =>
        h('button', { type: 'button', class: 'lang-row', role: 'radio', lang: id, 'aria-checked': String(getLang() === id), onclick: () => ctx.setLang(id) }, h('span', { html: flagSvg(id) }), h('span', { class: 'grow' }, l.label), getLang() === id ? h('span', { html: icon('check', { size: 20 }) }) : null),
      ),
    ),
  );

  // General
  const nameInput = h('input', { type: 'text', class: 'input', id: 'set-name', maxlength: '40', value: prefs.name, placeholder: t('settings.namePlaceholder'), autocomplete: 'given-name' });
  nameInput.addEventListener('change', () => ctx.setPref('name', nameInput.value.trim(), { silent: true }));
  const toggle = (id, label, help, checked, onToggle) =>
    h(
      'div',
      { class: 'toggle-row' },
      h('div', { class: 'grow' }, h('label', { id: `${id}-l`, for: id }, label), h('small', { class: 'muted' }, help)),
      h('button', { type: 'button', id, class: 'switch', role: 'switch', 'aria-checked': String(checked), 'aria-labelledby': `${id}-l`, onclick: () => onToggle(!checked) }),
    );
  panel.append(
    h('h2', { class: 'set-h' }, t('settings.general')),
    h('div', { class: 'field' }, h('label', { for: 'set-name' }, t('settings.name')), nameInput, h('small', { class: 'muted' }, t('settings.nameHelp'))),
    toggle('set-samples', t('settings.samples'), t('settings.samplesHelp'), prefs.showSamples, (v) => ctx.setPref('showSamples', v)),
  );

  const systemReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  panel.append(
    h('h2', { class: 'set-h', id: 'set-motion-h' }, t('settings.motion')),
    h(
      'div',
      { class: 'motion-opts', role: 'radiogroup', 'aria-labelledby': 'set-motion-h' },
      [['full', 'sparkle'], ['calm', 'moon'], ['off', 'x']].map(([id, ic]) =>
        h('button', { type: 'button', class: 'theme-opt', role: 'radio', 'data-motion-opt': id, 'aria-checked': String(prefs.motion === id), onclick: () => ctx.setPref('motion', id) }, h('span', { html: icon(ic, { size: 22 }) }), h('span', null, t(`settings.motionLevels.${id}`)), h('small', null, t(`settings.motionLevelHelp.${id}`))),
      ),
    ),
    h('p', { class: 'muted small' }, systemReduced ? t('settings.motionSystemOn') : t('settings.motionHelp')),
  );

  // Rows
  const list = h('ul', { class: 'rows' });
  for (const [key, ic] of SOON_ROWS) {
    list.append(h('li', null, h('div', { class: 'row disabled', 'aria-disabled': 'true' }, h('span', { class: 'row-ico', html: icon(ic, { size: 22 }) }), h('span', { class: 'grow' }, t(`settings.${key}`)), h('span', { class: 'soon' }, t('settings.soon')))));
  }
  const last = prefs.lastBackup ? t('backup.last', { date: formatDate(new Date(prefs.lastBackup).toISOString().slice(0, 10)) }) : t('backup.never');
  const dataRow = (ic, label, sub, onclick) => h('li', null, h('button', { type: 'button', class: 'row', onclick }, h('span', { class: 'row-ico', html: icon(ic, { size: 22 }) }), h('span', { class: 'grow' }, h('span', { class: 'row-title' }, label), sub ? h('small', { class: 'row-sub muted' }, sub) : null), h('span', { html: icon('chevronRight', { size: 20 }) })));
  list.append(
    dataRow('bell', t('settings.notifications'), t('reminders.settingsHelp'), () => openNotificationSettings()),
    dataRow('calendar', t('reminders.exportAll'), t('reminders.exportAllHelp'), () => exportAllToCalendar()),
    dataRow('upload', t('settings.exportData'), last, () => runExport(ctx)),
    dataRow('download', t('settings.importData'), t('backup.importHelp'), () => pickAndImport(ctx)),
    h('li', null, h('button', { type: 'button', class: 'row', onclick: () => showPwa(ctx) }, h('span', { class: 'row-ico', html: icon('wifiOff', { size: 22 }) }), h('span', { class: 'grow' }, t('settings.pwa')), h('span', { html: icon('chevronRight', { size: 20 }) }))),
    h('li', null, h('button', { type: 'button', class: 'row', onclick: () => showAbout() }, h('span', { class: 'row-ico', html: icon('info', { size: 22 }) }), h('span', { class: 'grow' }, t('settings.about')), h('span', { html: icon('chevronRight', { size: 20 }) }))),
  );
  panel.append(h('h2', { class: 'set-h' }, t('settings.data')), list);

  root.append(panel);
  return root;
}

function showAbout() {
  openModal({
    title: t('about.title'),
    content: [h('p', null, t('about.body')), h('p', { class: 'note' }, t('about.license')), h('p', { class: 'muted small' }, t('app.version', { version: '0.1.0' }))],
    actions: [{ label: t('actions.gotIt') }],
  });
}

async function showPwa(ctx) {
  const pwa = ctx.pwa;
  const dl = h('dl', { class: 'pwa-list' });
  const add = (label, value) => dl.append(h('dt', null, label), h('dd', null, value));
  add(t('pwa.status'), navigator.onLine ? t('pwa.online') : t('pwa.offline'));
  const supported = 'serviceWorker' in navigator;
  add(t('pwa.offlineReady'), !supported ? t('pwa.offlineUnsupported') : pwa.offlineReady() ? t('pwa.offlineReadyYes') : t('pwa.offlineReadyNo'));
  add(t('pwa.installed'), pwa.isInstalled() ? t('pwa.installedYes') : t('pwa.installNote'));
  let storage = t('pwa.storageUnknown');
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage } = await navigator.storage.estimate();
      if (typeof usage === 'number') storage = formatBytes(usage);
    }
  } catch {
    /* estimate unavailable */
  }
  add(t('pwa.storage'), storage);
  let protectedStore = null;
  try {
    if (navigator.storage && navigator.storage.persisted) protectedStore = await navigator.storage.persisted();
  } catch {
    /* unavailable */
  }
  if (protectedStore !== null) add(t('pwa.protected'), protectedStore ? t('pwa.protectedYes') : t('pwa.protectedNo'));
  const actions = [];
  if (pwa.canInstall()) actions.push({ label: t('actions.install'), onClick: async (close) => { await pwa.install(); close(); } });
  if (pwa.updateAvailable()) actions.push({ label: t('pwa.reload'), onClick: () => pwa.applyUpdate() });
  actions.push({ label: t('actions.gotIt'), variant: pwa.canInstall() ? 'secondary' : 'primary' });
  openModal({ title: t('pwa.title'), content: [dl], actions });
}
