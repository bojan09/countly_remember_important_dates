// Accessible, interactive SVG/DOM charts. Every chart has (1) a text summary exposed to assistive
// tech, (2) keyboard/hover details, and (3) a "view as table" fallback with the exact numbers.
import { h } from './ui.js';
import { t, formatNumber, formatDate, monthShort } from '../i18n/index.js';
import { heatGrid, heatLevel } from '../events/analytics.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

/** Collapsible exact-data table. rows: array of arrays of text. */
export function dataTable({ caption, headers, rows }) {
  return h(
    'details',
    { class: 'data-table' },
    h('summary', null, t('stats.viewTable')),
    h('table', null, h('caption', { class: 'sr-only' }, caption), h('thead', null, h('tr', null, headers.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, c) : h('td', null, c))))))),
  );
}

/** Circular progress. value is 0-100. The arc animates from empty on first paint. */
export function ring({ value, title, caption, color = 'var(--accent)', size = 104, label }) {
  const r = 42;
  const C = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  const svg = svgEl('svg', { viewBox: '0 0 100 100', width: size, height: size, class: 'ring-svg', 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { cx: 50, cy: 50, r, fill: 'none', 'stroke-width': 9, class: 'ring-track' }));
  const arc = svgEl('circle', { cx: 50, cy: 50, r, fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', class: 'ring-arc', transform: 'rotate(-90 50 50)', 'stroke-dasharray': `${(C * v) / 100} ${C}` });
  arc.style.setProperty('--ring-len', String(C));
  arc.style.setProperty('--ring-to', String((C * v) / 100));
  arc.style.stroke = color;
  svg.append(arc);
  return h(
    'figure',
    { class: 'ring', role: 'img', 'aria-label': label || `${title}: ${v}%` },
    h('div', { class: 'ring-wrap' }, svg, h('b', { class: 'ring-num', 'aria-hidden': 'true' }, `${v}%`)),
    h('figcaption', null, h('span', { class: 'ring-title' }, title), caption ? h('small', null, caption) : null),
  );
}

/** Interactive donut. Slices are focusable; hovering or focusing one shows its details in the centre. */
export function donutChart({ segments, total, centerLabel, summary }) {
  const r = 60;
  const C = 2 * Math.PI * r;
  const svg = svgEl('svg', { viewBox: '0 0 160 160', class: 'donut', 'aria-hidden': 'false', role: 'group', 'aria-label': summary });
  const num = h('b', null, formatNumber(total));
  const cap = h('small', null, centerLabel);
  const center = h('div', { class: 'donut-center' }, num, cap);
  const reset = () => {
    num.textContent = formatNumber(total);
    cap.textContent = centerLabel;
    svg.querySelectorAll('.donut-seg').forEach((s) => s.classList.remove('dim', 'on'));
    legend.querySelectorAll('li').forEach((li) => li.classList.remove('on'));
  };
  const show = (seg, node) => {
    num.textContent = formatNumber(seg.count);
    cap.textContent = `${seg.label} · ${Math.round((seg.count / total) * 100)}%`;
    svg.querySelectorAll('.donut-seg').forEach((s) => s.classList.toggle('dim', s !== node));
    node.classList.add('on');
  };
  const legend = h('ul', { class: 'legend' });
  let cum = 0;
  for (const seg of segments) {
    const len = (seg.count / total) * C;
    const c = svgEl('circle', { cx: 80, cy: 80, r, fill: 'none', 'stroke-width': 26, class: 'donut-seg', transform: 'rotate(-90 80 80)', tabindex: 0, role: 'img', 'aria-label': `${seg.label}: ${formatNumber(seg.count)} (${Math.round((seg.count / total) * 100)}%)`, 'stroke-dasharray': `${Math.max(len - 1.5, 0)} ${C}`, 'stroke-dashoffset': -cum });
    c.style.stroke = seg.color;
    c.addEventListener('mouseenter', () => show(seg, c));
    c.addEventListener('focus', () => show(seg, c));
    c.addEventListener('mouseleave', reset);
    c.addEventListener('blur', reset);
    svg.append(c);
    const li = h('li', { 'data-cat': seg.id }, h('i', { style: { background: seg.color } }), h('span', null, seg.label), h('b', null, formatNumber(seg.count)));
    li.addEventListener('mouseenter', () => show(seg, c));
    li.addEventListener('mouseleave', reset);
    legend.append(li);
    cum += len;
  }
  return h('div', { class: 'donut-row' }, h('div', { class: 'donut-wrap' }, svg, center), legend);
}

/** Monthly column chart. Each column is a button so it works with keyboard and touch. */
export function barChart({ values, year, summary, unitLabel }) {
  const max = Math.max(...values, 1);
  const tip = h('p', { class: 'chart-tip', 'aria-hidden': 'true' }, t('stats.barHint'));
  const defaultTip = tip.textContent;
  const cols = values.map((n, i) => {
    const text = `${monthShort(i + 1)} ${year}: ${t('categories.count', { count: n })}`;
    const col = h(
      'button',
      { type: 'button', class: `bar-col${n === max && n > 0 ? ' peak' : ''}`, 'aria-label': text },
      h('span', { class: 'bar-track' }, n ? h('span', { class: 'bar', style: { height: `${Math.max((n / max) * 100, 8)}%`, '--i': String(i) } }, h('span', { class: 'bar-tip' }, String(n))) : null),
      h('small', null, monthShort(i + 1)),
    );
    const on = () => (tip.textContent = text);
    col.addEventListener('mouseenter', on);
    col.addEventListener('focus', on);
    col.addEventListener('mouseleave', () => (tip.textContent = defaultTip));
    col.addEventListener('blur', () => (tip.textContent = defaultTip));
    return col;
  });
  return h('div', { class: 'bars-wrap' }, h('div', { class: 'bars', role: 'group', 'aria-label': summary }, cols), tip);
}

/** Year heatmap: 7 rows (week days) x ~53 week columns. Days with events are links to that day. */
export function heatmap({ year, counts, today, weekStart = 1, summary }) {
  const { columns, monthStarts } = heatGrid(year, weekStart);
  const max = Math.max(0, ...counts.values());
  const cell = 13;
  const gap = 3;
  const left = 0;
  const top = 18;
  const W = left + columns.length * (cell + gap);
  const H = top + 7 * (cell + gap);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'heat', role: 'group', 'aria-label': summary });
  const tip = h('p', { class: 'chart-tip', 'aria-hidden': 'true' }, t('stats.heatHint'));
  const defaultTip = tip.textContent;
  for (const [col, m] of monthStarts) {
    const label = svgEl('text', { x: left + col * (cell + gap), y: 11, class: 'heat-month' });
    label.textContent = monthShort(m);
    svg.append(label);
  }
  columns.forEach((days, ci) => {
    days.forEach((iso, ri) => {
      if (!iso) return;
      const n = counts.get(iso) || 0;
      const text = t('stats.heatCell', { date: formatDate(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), count: n });
      const rect = svgEl('rect', { x: left + ci * (cell + gap), y: top + ri * (cell + gap), width: cell, height: cell, rx: 3, class: `heat-cell lv${heatLevel(n, max)}${iso === today ? ' today' : ''}` });
      const hover = () => (tip.textContent = text);
      const out = () => (tip.textContent = defaultTip);
      let node = rect;
      if (n) {
        node = svgEl('a', { href: `#/calendar?view=day&d=${iso}`, 'aria-label': text });
        node.append(rect);
        node.addEventListener('focus', hover);
        node.addEventListener('blur', out);
      }
      node.addEventListener('mouseenter', hover);
      node.addEventListener('mouseleave', out);
      svg.append(node);
    });
  });
  const legend = h('div', { class: 'heat-legend', 'aria-hidden': 'true' }, h('small', null, t('stats.heatLess')), [0, 1, 2, 3, 4].map((l) => h('i', { class: `heat-swatch lv${l}` })), h('small', null, t('stats.heatMore')));
  return h('div', { class: 'heat-wrap' }, h('div', { class: 'heat-scroll' }, svg), h('div', { class: 'heat-foot' }, tip, legend));
}
