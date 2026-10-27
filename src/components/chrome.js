// Per-view chrome: desktop top bar and the mobile sub-page header.
import { h } from './ui.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';

export function addEventButton({ compact = false } = {}) {
  return h(
    'a',
    { href: '#/new', class: compact ? 'icon-btn solid' : 'btn primary', 'aria-label': compact ? t('actions.addEvent') : null },
    h('span', { html: icon('plus', { size: compact ? 22 : 18 }) }),
    compact ? null : h('span', null, t('actions.addEvent')),
  );
}

export function bellButton(onClick) {
  return h('button', { type: 'button', class: 'icon-btn', 'data-bell': '', 'aria-label': t('actions.notifications'), onclick: onClick, html: icon('bell', { size: 22 }) });
}

export function searchBox(ctx, { value = '' } = {}) {
  const input = h('input', { type: 'search', placeholder: t('actions.search'), 'aria-label': t('actions.searchLabel'), value, autocomplete: 'off' });
  const form = h('form', { class: 'search', role: 'search', onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); ctx.navigate(q ? `#/timeline?q=${encodeURIComponent(q)}` : '#/timeline'); } }, h('span', { html: icon('search', { size: 18 }) }), input);
  return form;
}

/** Desktop/tablet header: title block on the left, actions on the right. */
export function pageHeader(ctx, { title, sub, value }) {
  return h(
    'header',
    { class: 'topbar' },
    h('div', null, h('h1', null, title), sub ? h('p', { class: 'sub' }, sub) : null),
  );
}

/** Mobile sub-page header (X / back, centered title). */
export function mobilePageHead(ctx, title, { back = false } = {}) {
  return h(
    'div',
    { class: 'm-page-head only-mobile' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': back ? t('nav.back') : t('nav.close'), onclick: () => ctx.goBack(), html: icon(back ? 'chevronLeft' : 'x', { size: 22 }) }),
    h('h1', null, title),
    h('span', { class: 'm-page-spacer', 'aria-hidden': 'true' }),
  );
}
