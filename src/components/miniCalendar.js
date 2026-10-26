import { h, clear } from './ui.js';
import { icon } from './icons.js';
import { calendarGrid } from './calendarGrid.js';
import { parseISODate, shiftMonth } from '../date/calendar.js';
import { t, formatMonthYear } from '../i18n/index.js';

let shown = null; // remembered between renders: { y, m }

export function miniCalendar(ctx) {
  const tp = parseISODate(ctx.today);
  if (!shown) shown = { y: tp.y, m: tp.m };

  const title = h('h2', { id: 'mc-title' });
  const body = h('div');
  const root = h(
    'section',
    { class: 'panel minical', 'aria-label': t('home.miniCalendar') },
    h(
      'div',
      { class: 'mc-head' },
      title,
      h(
        'div',
        { class: 'mc-nav' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('actions.previousMonth'), onclick: () => move(-1), html: icon('chevronLeft', { size: 20 }) }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('actions.nextMonth'), onclick: () => move(1), html: icon('chevronRight', { size: 20 }) }),
      ),
    ),
    body,
  );

  function draw() {
    title.textContent = formatMonthYear(shown.y, shown.m);
    clear(body).append(
      calendarGrid({
        year: shown.y,
        month: shown.m,
        events: ctx.events,
        today: ctx.today,
        compact: true,
        onSelect: (iso) => ctx.navigate(`#/calendar?d=${iso}`),
      }),
    );
  }
  function move(delta) {
    shown = shiftMonth(shown, delta);
    draw();
  }
  draw();
  return root;
}
