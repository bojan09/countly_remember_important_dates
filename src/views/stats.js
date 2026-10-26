import { h, segmented, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { ring, donutChart, barChart, heatmap, dataTable } from '../components/charts.js';
import { countByCategory, upcoming, past, uniqueSeries, featuredEvent } from '../events/select.js';
import { CATEGORIES } from '../events/categories.js';
import { monthlyCounts, dayCounts, busiest, yearProgress, doneStats } from '../events/analytics.js';
import { progress, parseISODate } from '../date/calendar.js';
import { t, formatNumber, formatDate, monthShort } from '../i18n/index.js';
import { getOccurrencesBetween } from '../store/events.js';
import { eventTitle } from '../store/demo.js';

// View state survives language / store re-renders within the session.
let tab = 'overview';
let year = null;

export default function renderStats(ctx) {
  const { today, events } = ctx;
  const thisYear = parseISODate(today).y;
  if (year == null) year = thisYear;
  const total = uniqueSeries(events).length;

  const root = h('div', { class: 'view stats' }, pageHeader(ctx, { title: t('stats.title') }), mobilePageHead(ctx, t('stats.title')));
  const tabsHost = h('div');
  const body = h('div', { class: 'stats-body' });
  root.append(tabsHost, body);

  function drawTabs() {
    tabsHost.replaceChildren(
      segmented({
        label: t('stats.title'),
        value: tab,
        onChange: (id) => {
          tab = id;
          drawTabs();
          draw();
        },
        items: [
          { id: 'overview', label: t('tabs.overview') },
          { id: 'categories', label: t('tabs.categories') },
          { id: 'calendar', label: t('tabs.calendar') },
        ],
      }),
    );
  }

  const segmentsOf = (map) =>
    CATEGORIES.concat([{ id: 'other', color: 'var(--cat-other)' }])
      .filter((c) => map.get(c.id))
      .map((c) => ({ id: c.id, color: c.color, count: map.get(c.id), label: t(`categories.${c.id}`) }));

  function distribution(segments, n) {
    const top = [...segments].sort((a, b) => b.count - a.count)[0];
    const summary = t('stats.summary', { total: n, categories: segments.length, top: top.label });
    return h(
      'section',
      { class: 'paper chart-card' },
      h('h2', { class: 'sheet-title' }, t('stats.byCategory')),
      donutChart({ segments, total: n, centerLabel: t('stats.events'), summary }),
      h('p', { class: 'sr-only' }, summary),
      dataTable({ caption: t('stats.byCategory'), headers: [t('stats.tableCategory'), t('stats.tableEvents'), t('stats.share')], rows: segments.map((s) => [s.label, formatNumber(s.count), `${Math.round((s.count / n) * 100)}%`]) }),
    );
  }

  function overview() {
    const yearOcc = getOccurrencesBetween(`${thisYear}-01-01`, `${thisYear}-12-31`, today);
    const segments = segmentsOf(countByCategory(events));
    const tiles = [
      ['calendar', total, t('kpi.total'), 'var(--cat-travel)'],
      ['star', upcoming(events, today).length, t('tabs.upcoming'), 'var(--gold)'],
      ['check', past(events, today).length, t('kpi.completed'), 'var(--cat-travel)'],
      ['tag', segments.length, t('kpi.categories'), 'var(--cat-personal)'],
    ];
    const yp = yearProgress(today);
    const done = doneStats(yearOcc, today);
    const next = featuredEvent(events, today);
    const nextProg = next ? progress(next.start, next.date, today) : null;
    const nextCaption = next ? eventTitle(next) : t('home.noUpcoming');
    const rings = h(
      'section',
      { class: 'rings', 'aria-label': t('stats.title') },
      ring({ value: yp.percent, title: t('stats.yearProgress'), caption: String(yp.year), color: 'var(--cat-travel)', label: t('stats.yearProgressLabel', { percent: yp.percent, year: yp.year }) }),
      ring({ value: done.percent, title: t('stats.doneRing'), caption: `${formatNumber(done.done)} / ${formatNumber(done.total)}`, color: 'var(--cat-health)', label: t('stats.doneRingLabel', { done: done.done, total: done.total }) }),
      nextProg
        ? ring({ value: nextProg.percent, title: t('stats.nextRing'), caption: nextCaption, color: 'var(--cat-celebration)', label: t('stats.nextRingLabel', { percent: nextProg.percent, title: nextCaption }) })
        : ring({ value: 0, title: t('stats.nextRing'), caption: next ? t('stats.nextRingNone') : nextCaption, color: 'var(--cat-celebration)', label: `${t('stats.nextRing')}: ${next ? t('stats.nextRingNone') : nextCaption}` }),
    );
    return [
      h('div', { class: 'stat-tiles' }, tiles.map(([ic, n, label, color]) => h('div', { class: 'stat-tile', style: { '--k': color } }, h('span', { class: 'st-ico', html: icon(ic, { size: 22 }) }), h('b', null, formatNumber(n)), h('small', null, label)))),
      rings,
      distribution(segments, total),
      h('p', { class: 'muted small' }, t('stats.sampleNote')),
    ];
  }

  function categoriesTab() {
    const segments = segmentsOf(countByCategory(events));
    const max = Math.max(...segments.map((s) => s.count), 1);
    return [
      distribution(segments, total),
      h(
        'section',
        { class: 'paper chart-card' },
        h('h2', { class: 'sheet-title' }, t('stats.distribution')),
        h(
          'ul',
          { class: 'cat-bars' },
          segments.map((s) =>
            h(
              'li',
              null,
              h(
                'a',
                { href: `#/timeline?cat=${s.id}`, class: 'cat-bar', style: { '--c': s.color }, 'aria-label': `${s.label}: ${t('categories.count', { count: s.count })}` },
                h('span', { class: 'cb-name' }, s.label),
                h('span', { class: 'cb-track', 'aria-hidden': 'true' }, h('i', { style: { width: `${(s.count / max) * 100}%` } })),
                h('b', null, formatNumber(s.count)),
                h('small', null, `${Math.round((s.count / total) * 100)}%`),
              ),
            ),
          ),
        ),
      ),
    ];
  }

  function calendarTab() {
    const yearOcc = getOccurrencesBetween(`${year}-01-01`, `${year}-12-31`, today);
    const months = monthlyCounts(yearOcc, year);
    const byDay = dayCounts(yearOcc);
    const peakMonth = busiest(new Map(months.map((n, i) => [String(i).padStart(2, '0'), n])));
    const peakDay = busiest(byDay);
    const totalY = yearOcc.length;
    const monthSummary = totalY ? t('stats.monthlySummary', { total: totalY, year, month: monthShort(Number(peakMonth.key) + 1), count: peakMonth.count }) : t('stats.monthlyNone', { year });
    const heatSummary = totalY ? t('stats.heatSummary', { total: totalY, days: byDay.size, year, date: formatDate(peakDay.key), count: peakDay.count }) : t('stats.heatNone', { year });

    const switcher = h(
      'div',
      { class: 'year-switch' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('stats.prevYear'), onclick: () => { year--; draw(); }, html: icon('chevronLeft', { size: 20 }) }),
      h('b', { 'aria-live': 'polite' }, t('stats.yearLabel', { year })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('stats.nextYear'), onclick: () => { year++; draw(); }, html: icon('chevronRight', { size: 20 }) }),
    );
    return [
      switcher,
      h(
        'section',
        { class: 'paper chart-card' },
        h('h2', { class: 'sheet-title' }, t('stats.monthlyTitle')),
        barChart({ values: months, year, summary: monthSummary }),
        h('p', { class: 'sr-only' }, monthSummary),
        dataTable({ caption: t('stats.monthlyTitle'), headers: [t('stats.tableMonth'), t('stats.tableEvents')], rows: months.map((n, i) => [`${monthShort(i + 1)} ${year}`, formatNumber(n)]) }),
      ),
      h(
        'section',
        { class: 'paper chart-card' },
        h('h2', { class: 'sheet-title' }, t('stats.heatTitle')),
        heatmap({ year, counts: byDay, today, summary: heatSummary }),
        h('p', { class: 'sr-only' }, heatSummary),
        dataTable({
          caption: t('stats.heatTitle'),
          headers: [t('stats.tableDay'), t('stats.tableEvents')],
          rows: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([iso, n]) => [formatDate(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }), formatNumber(n)]),
        }),
      ),
    ];
  }

  function draw() {
    if (!total && tab !== 'calendar') {
      body.replaceChildren(emptyState({ iconName: 'stats', title: t('home.emptyTitle'), body: t('home.emptyBody') }));
      return;
    }
    body.replaceChildren(...(tab === 'overview' ? overview() : tab === 'categories' ? categoriesTab() : calendarTab()));
  }

  drawTabs();
  draw();
  return root;
}
