import { h, segmented, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { calendarGrid, indexByDate } from '../components/calendarGrid.js';
import { parseISODate, shiftMonth } from '../date/calendar.js';
import { t, formatMonthYear, formatDate } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { categoryById } from '../events/categories.js';

let shown = null;

export default function renderCalendar(ctx) {
  const { today, events } = ctx;
  const wanted = ctx.query.get('d');
  const wantedP = wanted && parseISODate(wanted);
  const tp = parseISODate(today);
  if (wantedP) shown = { y: wantedP.y, m: wantedP.m };
  if (!shown) shown = { y: tp.y, m: tp.m };
  let selected = wantedP ? wanted : today;

  const byDate = indexByDate(events);
  const title = h('h2', { class: 'cal-title', 'aria-live': 'polite' });
  const gridHost = h('div');
  const sheet = h('section', { class: 'paper day-sheet', 'aria-live': 'polite' });

  const root = h(
    'div',
    { class: 'view calendar' },
    pageHeader(ctx, { title: t('calendar.title') }),
    mobilePageHead(ctx, t('calendar.title')),
    h(
      'div',
      { class: 'cal-layout' },
      h(
        'div',
        { class: 'panel cal-panel' },
        segmented({
          label: t('calendar.title'),
          value: 'month',
          onChange: () => {},
          items: [
            { id: 'month', label: t('tabs.month') },
            { id: 'week', label: t('tabs.week'), disabled: true },
            { id: 'agenda', label: t('tabs.agenda'), disabled: true },
          ],
        }),
        h(
          'div',
          { class: 'cal-bar' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('actions.previousMonth'), onclick: () => move(-1), html: icon('chevronLeft', { size: 22 }) }),
          title,
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('actions.nextMonth'), onclick: () => move(1), html: icon('chevronRight', { size: 22 }) }),
        ),
        gridHost,
        h('p', { class: 'note' }, t('calendar.comingWeek')),
      ),
      sheet,
    ),
  );

  function draw() {
    title.textContent = formatMonthYear(shown.y, shown.m);
    gridHost.replaceChildren(
      calendarGrid({
        year: shown.y,
        month: shown.m,
        events,
        today,
        selected,
        onSelect: (iso) => {
          selected = iso;
          const p = parseISODate(iso);
          shown = { y: p.y, m: p.m };
          draw();
        },
      }),
    );
    const list = byDate.get(selected) || [];
    sheet.replaceChildren(
      h('h3', { class: 'sheet-title' }, t('calendar.eventsOn', { date: formatDate(selected, { month: 'short', day: 'numeric' }) })),
      list.length
        ? h(
            'ul',
            { class: 'day-list' },
            list.map((e) => {
              const cat = categoryById(e.category);
              return h(
                'li',
                null,
                h(
                  'a',
                  { href: `#/event/${encodeURIComponent(e.id)}`, class: 'day-item' },
                  h('span', { class: 'day-ico', style: { '--c': cat.color }, html: icon(cat.icon, { size: 22 }) }),
                  h('span', { class: 'day-txt' }, h('b', null, eventTitle(e)), h('small', null, t(`categories.${cat.id}`))),
                  h('span', { class: 'chev', html: icon('chevronRight', { size: 20 }) }),
                ),
              );
            }),
          )
        : h('p', { class: 'muted' }, t('calendar.noEvents')),
    );
  }
  function move(delta) {
    shown = shiftMonth(shown, delta);
    draw();
  }
  draw();
  return root;
}
