// Desktop / tablet top navigation with accessible dropdown menus.
// Mobile (<768px) keeps the bottom navigation; this bar is hidden there by CSS.
import { h } from './ui.js';
import { icon, flagSvg } from './icons.js';
import { logoMark } from './logo.js';
import { t, getLang, LANGS } from '../i18n/index.js';

let openMenu = null; // { trigger, menu }

function closeMenu({ restoreFocus = false } = {}) {
  if (!openMenu) return;
  const { trigger, menu } = openMenu;
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger.focus();
  openMenu = null;
}

function items(menu) {
  return [...menu.querySelectorAll('[role^="menuitem"]')].filter((el) => !el.disabled);
}

/** Wire a trigger button to a menu element (role=menu). */
function attachMenu(trigger, menu) {
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  menu.hidden = true;
  const open = (focusFirst = false) => {
    if (openMenu && openMenu.menu !== menu) closeMenu();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openMenu = { trigger, menu };
    if (focusFirst) items(menu)[0]?.focus();
  };
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) open(false);
    else closeMenu();
  });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open(true);
      if (e.key === 'ArrowUp') items(menu).at(-1)?.focus();
    }
  });
  menu.addEventListener('keydown', (e) => {
    const list = items(menu);
    const i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu({ restoreFocus: true });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list.at(-1)?.focus();
    } else if (e.key === 'Tab') {
      closeMenu();
    }
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });
}

let globalWired = false;
function wireGlobalClose() {
  if (globalWired) return;
  globalWired = true;
  document.addEventListener('click', (e) => {
    if (openMenu && !openMenu.menu.contains(e.target) && !openMenu.trigger.contains(e.target)) closeMenu();
  });
  window.addEventListener('hashchange', () => closeMenu());
  window.addEventListener('blur', () => closeMenu());
}

const link = (href, ic, label) => h('a', { role: 'menuitem', class: 'dd-item', href }, h('span', { html: icon(ic, { size: 18 }) }), h('span', null, label));

/** A top-level destination: a link, optionally with a caret that opens a menu of sub-destinations. */
function destination({ nav, href, ic, label, menu: entries }) {
  const wrap = h('div', { class: 'tn-item' });
  const main = h('a', { class: 'tn-link', href, 'data-nav': nav, 'aria-label': label }, h('span', { html: icon(ic, { size: 20 }) }), h('span', { class: 'lbl' }, label));
  wrap.append(main);
  if (entries) {
    const menu = h('div', { class: 'dd', role: 'menu', 'aria-label': label }, entries.map(([ei, el, eh]) => link(eh, ei, el)));
    const caret = h('button', { type: 'button', class: 'tn-caret', 'aria-label': t('nav.optionsFor', { name: label }), html: icon('chevronDown', { size: 16 }) });
    wrap.append(caret, menu);
    attachMenu(caret, menu);
  }
  return wrap;
}

/** A menu-only group (no page of its own). */
function group({ nav, ic, label, entries }) {
  const wrap = h('div', { class: 'tn-item' });
  const menu = h('div', { class: 'dd', role: 'menu', 'aria-label': label }, entries.map(([ei, el, eh]) => link(eh, ei, el)));
  const btn = h('button', { type: 'button', class: 'tn-link', 'data-nav': nav, 'aria-label': label }, h('span', { html: icon(ic, { size: 20 }) }), h('span', { class: 'lbl' }, label), h('span', { class: 'caret-ico', html: icon('chevronDown', { size: 16 }) }));
  wrap.append(btn, menu);
  attachMenu(btn, menu);
  return wrap;
}

export function buildTopNav({ onLanguage, onTheme, currentTheme, onBell }) {
  wireGlobalClose();

  const search = h('form', { class: 'tn-search', role: 'search', onsubmit: (e) => {
    e.preventDefault();
    const q = e.currentTarget.querySelector('input').value.trim();
    location.hash = q ? `#/timeline?q=${encodeURIComponent(q)}` : '#/timeline';
  } }, h('span', { html: icon('search', { size: 18 }) }), h('input', { type: 'search', placeholder: t('actions.search'), 'aria-label': t('actions.searchLabel'), autocomplete: 'off' }));

  // account / preferences menu
  const prefMenu = h('div', { class: 'dd right', role: 'menu', 'aria-label': t('nav.preferences') });
  prefMenu.append(link('#/settings', 'settings', t('nav.settings')));
  prefMenu.append(h('div', { class: 'dd-label', 'aria-hidden': 'true' }, t('settings.language')));
  for (const [id, l] of Object.entries(LANGS)) {
    prefMenu.append(h('button', { type: 'button', role: 'menuitemradio', class: 'dd-item', lang: id, 'data-lang-btn': id, 'aria-checked': String(getLang() === id), onclick: () => { closeMenu(); onLanguage(id); } }, h('span', { html: flagSvg(id) }), h('span', null, l.label)));
  }
  prefMenu.append(h('div', { class: 'dd-label', 'aria-hidden': 'true' }, t('settings.appearance')));
  for (const [id, ic, label] of [['light', 'sun', 'settings.light'], ['dark', 'moon', 'settings.dark'], ['auto', 'auto', 'settings.auto']]) {
    prefMenu.append(h('button', { type: 'button', role: 'menuitemradio', class: 'dd-item', 'data-theme-btn': id, 'aria-checked': String(currentTheme === id), onclick: () => { onTheme(id); } }, h('span', { html: icon(ic, { size: 18 }) }), h('span', null, t(label))));
  }
  const prefBtn = h('button', { type: 'button', class: 'icon-btn tn-pref', 'data-nav': 'settings', 'aria-label': t('nav.preferences'), html: icon('settings', { size: 22 }) });
  attachMenu(prefBtn, prefMenu);

  return h(
    'header',
    { class: 'topnav' },
    h(
      'div',
      { class: 'tn-inner' },
      h('a', { class: 'brand', href: '#/', 'aria-label': `${t('app.name')} — ${t('nav.home')}` }, h('span', { html: logoMark(32) }), h('span', { class: 'brand-name' }, t('app.name'))),
      h(
        'nav',
        { class: 'tn-nav', 'aria-label': t('nav.main') },
        destination({ nav: 'home', href: '#/', ic: 'home', label: t('nav.home') }),
        destination({
          nav: 'calendar',
          href: '#/calendar',
          ic: 'calendar',
          label: t('nav.calendar'),
          menu: [['calendar', t('calendar.viewMonth'), '#/calendar?view=month'], ['calendar', t('calendar.viewWeek'), '#/calendar?view=week'], ['calendar', t('calendar.viewDay'), '#/calendar?view=day'], ['timeline', t('calendar.viewAgenda'), '#/calendar?view=agenda']],
        }),
        destination({
          nav: 'timeline',
          href: '#/timeline',
          ic: 'timeline',
          label: t('nav.timeline'),
          menu: [['timeline', t('tabs.all'), '#/timeline?f=all'], ['calendar', t('tabs.upcoming'), '#/timeline?f=upcoming'], ['memories', t('tabs.past'), '#/timeline?f=past'], ['archive', t('timeline.archived'), '#/timeline?f=archived']],
        }),
        group({ nav: 'explore', ic: 'stats', label: t('nav.explore'), entries: [['stats', t('nav.stats'), '#/stats'], ['categories', t('nav.categories'), '#/categories'], ['memories', t('nav.memories'), '#/memories']] }),
      ),
      h(
        'div',
        { class: 'tn-actions' },
        search,
        h('a', { href: '#/timeline', class: 'icon-btn tn-search-ico', 'aria-label': t('actions.searchLabel'), html: icon('search', { size: 22 }) }),
        h('button', { type: 'button', class: 'icon-btn', 'data-bell': '', 'aria-label': t('actions.notifications'), onclick: onBell, html: icon('bell', { size: 22 }) }),
        h('a', { href: '#/new', class: 'btn primary tn-add' }, h('span', { html: icon('plus', { size: 18 }) }), h('span', { class: 'lbl' }, t('actions.addEvent'))),
        h('div', { class: 'tn-item' }, prefBtn, prefMenu),
      ),
    ),
  );
}
