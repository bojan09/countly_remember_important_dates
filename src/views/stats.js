import { h, segmented, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { countByCategory, countByMonth, upcoming, past } from '../events/select.js';
import { CATEGORIES, categoryById } from '../events/categories.js';
import { parseISODate } from '../date/calendar.js';
import { t, formatNumber, monthShort } from '../i18n/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function donut(segments, total) {
  const r = 60;
  const C = 2 * Math.PI * r;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 160 160');
  svg.setAttribute('class', 'donut');
  svg.setAttribute('aria-hidden', 'true');
  let cum = 0;
  for (const s of segments) {
    const len = (s.count / total) * C;
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', '80');
    c.setAttribute('cy', '80');
    c.setAttribute('r', String(r));
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke-width', '26');
    c.setAttribute('stroke-dasharray', `${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`);
    c.setAttribute('stroke-dashoffset', String(-cum));
    c.style.stroke = s.color;
    c.setAttribute('transform', 'rotate(-90 80 80)');
    svg.append(c);
    cum += len;
  }
  return svg;
}

export default function renderStats(ctx) {
  const { today, events } = ctx;
  const year = parseISODate(today).y;
  const total = events.length;
  const counts = countByCategory(events);
  const segments = CATEGORIES.filter((c) => counts.get(c.id)).map((c) => ({ id: c.id, color: c.color, count: counts.get(c.id) }));
  const months = countByMonth(events, year);
  const max = Math.max(...months, 1);

  const root = h('div', { class: 'view stats' }, pageHeader(ctx, { title: t('stats.title') }), mobilePageHead(ctx, t('stats.title')));

  root.append(
    segmented({
      label: t('stats.title'),
      value: 'overview',
      onChange: () => {},
      items: [
        { id: 'overview', label: t('tabs.overview') },
        { id: 'categories', label: t('tabs.categories'), disabled: true },
        { id: 'calendar', label: t('tabs.calendar'), disabled: true },
      ],
    }),
  );

  if (!total) {
    root.append(emptyState({ iconName: 'stats', title: t('home.emptyTitle'), body: t('home.emptyBody') }));
    return root;
  }

  const tiles = [
    ['calendar', total, t('kpi.total'), 'var(--cat-travel)'],
    ['star', upcoming(events, today).length, t('tabs.upcoming'), 'var(--gold)'],
    ['check', past(events, today).length, t('kpi.completed'), 'var(--cat-travel)'],
    ['tag', segments.length, t('kpi.categories'), 'var(--cat-personal)'],
  ];
  root.append(
    h(
      'div',
      { class: 'stat-tiles' },
      tiles.map(([ic, n, label, color]) => h('div', { class: 'stat-tile', style: { '--k': color } }, h('span', { class: 'st-ico', html: icon(ic, { size: 22 }) }), h('b', null, formatNumber(n)), h('small', null, label))),
    ),
  );

  const top = [...segments].sort((a, b) => b.count - a.count)[0];
  const summary = t('stats.summary', { total, categories: segments.length, top: t(`categories.${top.id}`) });

  const chart = h('section', { class: 'paper chart-card' });
  chart.append(
    h('h2', { class: 'sheet-title' }, t('stats.byCategory')),
    h(
      'div',
      { class: 'donut-row', role: 'img', 'aria-label': summary },
      h('div', { class: 'donut-wrap' }, donut(segments, total), h('div', { class: 'donut-center' }, h('b', null, formatNumber(total)), h('small', null, t('stats.events')))),
      h(
        'ul',
        { class: 'legend' },
        segments.map((s) => h('li', null, h('i', { style: { background: s.color } }), h('span', null, t(`categories.${s.id}`)), h('b', null, formatNumber(s.count)))),
      ),
    ),
    h('hr', { class: 'rule' }),
    h('h2', { class: 'sheet-title' }, t('stats.thisYear')),
  );

  const listText = months.map((n, i) => `${monthShort(i + 1)} ${n}`).join(', ');
  const bars = h(
    'div',
    { class: 'bars', role: 'img', 'aria-label': t('stats.chartSummary', { list: listText }) },
    months.map((n, i) =>
      h(
        'div',
        { class: `bar-col${n === max && n > 0 ? ' peak' : ''}` },
        h('div', { class: 'bar-track' }, n ? h('div', { class: 'bar', style: { height: `${Math.max((n / max) * 100, 8)}%` } }, n === max ? h('span', { class: 'bar-tip' }, String(n)) : null) : null),
        h('small', null, monthShort(i + 1)),
      ),
    ),
  );
  chart.append(bars, h('p', { class: 'muted small' }, t('stats.sampleNote')));

  root.append(chart);
  return root;
}
