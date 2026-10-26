// Tiny DOM toolkit + reusable modal / toast. User strings are only ever set via
// textContent / attributes, never innerHTML.
import { t } from '../i18n/index.js';
import { icon } from './icons.js';

/** h('div', {class:'x', onclick}, child, ...) - strings become text nodes. */
export function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v; // trusted, static markup only (icons / scenes)
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith('--')) node.style.setProperty(prop, val);
          else node.style[prop] = val;
        }
      }
      else node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function iconEl(name, opts) {
  const span = document.createElement('span');
  span.className = 'ico-wrap';
  span.innerHTML = icon(name, opts);
  return span;
}

/** Segmented tabs (Upcoming / This Month / Past). items: [{id,label,count?}] */
export function segmented({ items, value, onChange, label, variant = '' }) {
  const wrap = h('div', { class: `seg ${variant}`, role: 'tablist', 'aria-label': label || null });
  const buttons = items.map((it) => {
    const btn = h(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'seg-btn',
        'aria-selected': String(it.id === value),
        tabindex: it.id === value ? '0' : '-1',
        disabled: it.disabled || null,
        'data-id': it.id,
      },
      h('span', { class: 'seg-label' }, it.label),
      it.count != null ? h('span', { class: 'seg-count' }, String(it.count)) : null,
    );
    btn.addEventListener('click', () => !it.disabled && onChange(it.id));
    return btn;
  });
  wrap.append(...buttons);
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const enabled = buttons.filter((b) => !b.disabled);
    const i = enabled.indexOf(document.activeElement);
    if (i < 0) return;
    const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    next.focus();
    next.click();
  });
  return wrap;
}

/** Native <dialog> based modal (focus trap + Esc handled by the browser). */
export function openModal({ title, content, actions = [], variant = '', onClose }) {
  const dialog = h('dialog', { class: `modal ${variant}`, 'aria-labelledby': 'modal-title' });
  const close = () => dialog.close();
  const head = h(
    'div',
    { class: 'modal-head' },
    h('h2', { id: 'modal-title', class: 'modal-title' }, title),
    h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': t('nav.close'), onclick: close, html: icon('x', { size: 20 }) }),
  );
  const body = h('div', { class: 'modal-body' }, content);
  const foot = actions.length ? h('div', { class: 'modal-foot' }) : null;
  for (const a of actions) {
    foot.append(
      h('button', { type: 'button', class: `btn ${a.variant || 'primary'}`, onclick: () => (a.onClick ? a.onClick(close) : close()) }, a.label),
    );
  }
  dialog.append(head, body);
  if (foot) dialog.append(foot);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // backdrop click
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose && onClose();
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

let toastHost;
export function toast(message, { timeout = 3200 } = {}) {
  if (!toastHost) {
    toastHost = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const node = h('div', { class: 'toast' }, message);
  toastHost.append(node);
  const remove = () => node.remove();
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(remove, 260);
  }, timeout);
}

export function emptyState({ iconName = 'sparkle', title, body, action }) {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty-art', html: icon(iconName, { size: 34 }) }),
    h('h2', { class: 'empty-title' }, title),
    body ? h('p', { class: 'empty-body' }, body) : null,
    action || null,
  );
}

export function sampleBadge() {
  return h('span', { class: 'badge-sample' }, t('sample.badge'));
}
