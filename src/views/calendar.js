import { h, segmented } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { calendarGrid, indexByDate } from '../components/calendarGrid.js';
import { parseISODate, shiftMonth, addDays, weekdayOf, monthGrid, toISO } from '../date/calendar.js';
import { t, formatMonthYear, formatDate, weekdayNames } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { categoryById, categoryName } from '../events/categories.js';
import { getOccurrencesBetween } from '../store/events.js';

// View state survives re-renders (language switch, store updates) within the session.
let mode = 'month';
let cursor = null;

const MODES = ['month', 'week', 'day', 'agenda'];
const AGENDA_DAYS = 30;

const byTime = (a, b) => (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : eventTitle(a).localeCompare(eventTitle(b));
const mondayOf = (iso) => addDays(iso, -((weekdayOf(iso) + 6) % 7));

function eventRow(e) {
  const cat = categoryById(e.category);
  const sub = [e.time || t('calendar.allDay'), categoryName(cat), e.location].filter(Boolean).join(' · ');
  return h(
    'a',
    { href: `#/event/${encodeURIComponent(e.id)}`, class: 'day-item' },
    h('span', { class: 'day-ico', style: { '--c': cat.color }, html: icon(cat.icon, { size: 22 }) }),
    h('span', { class: 'day-txt' }, h('b', null, eventTitle(e), e.recurring ? h('span', { class: 'tl-pin', 'aria-hidden': 'true', html: icon('repeat', { size: 13 }) }) : null), h('small', null, sub)),
    h('span', { class: 'chev', 'aria-hidden': 'true', html: icon('chevronRight', { size: 20 }) }),
  );
}

export default function renderCalendar(ctx) {
  const { today } = ctx;
  const view = ctx.query.get('view');
  if (MODES.includes(view)) mode = view;
  const wanted = ctx.query.get('d');
  if (wanted && parseISODate(wanted)) cursor = wanted;
  if (!cursor || !parseISODate(cursor)) cursor = today;

  const title = h('h2', { class: 'cal-title', 'aria-live': 'polite' });
  const body = h('div', { class: 'cal-body' });
  const sheet = h('section', { class: 'paper day-sheet', 'aria-live': 'polite' });
  const tabsHost = h('div');

  const nav = {
    month: [t('actions.previousMonth'), t('actions.nextMonth')],
    week: [t('calendar.prevWeek'), t('calendar.nextWeek')],
    day: [t('calendar.prevDay'), t('calendar.nextDay')],
    agenda: [t('calendar.prevAgenda'), t('calendar.nextAgenda')],
  };
  const prevBtn = h('button', { type: 'button', class: 'icon-btn', onclick: () => move(-1), html: icon('chevronLeft', { size: 22 }) });
  const nextBtn = h('button', { type: 'button', class: 'icon-btn', onclick: () => move(1), html: icon('chevronRight', { size: 22 }) });
  const todayBtn = h('button', { type: 'button', class: 'btn secondary small', onclick: () => { cursor = today; draw(); } }, t('calendar.goToday'));

  const root = h(
    'div',
    { class: 'view calendar' },
    pageHeader(ctx, { title: t('calendar.title') }),
    mobilePageHead(ctx, t('calendar.title')),
    h('div', { class: `cal-layout mode-${mode}` }, h('div', { class: 'panel cal-panel' }, tabsHost, h('div', { class: 'cal-bar' }, prevBtn, title, nextBtn, todayBtn), body), sheet),
  );

  function drawTabs() {
    tabsHost.replaceChildren(
      segmented({
        label: t('calendar.viewSwitch'),
        value: mode,
        onChange: (id) => {
          mode = id;
          root.querySelector('.cal-layout').className = `cal-layout mode-${mode}`;
          drawTabs();
          draw();
        },
        items: MODES.map((id) => ({ id, label: t(`calendar.view${id[0].toUpperCase()}${id.slice(1)}`) })),
      }),
    );
  }

  function move(delta) {
    if (mode === 'month') {
      const p = parseISODate(cursor);
      const s = shiftMonth({ y: p.y, m: p.m }, delta);
      cursor = toISO({ y: s.y, m: s.m, d: 1 });
    } else if (mode === 'week') cursor = addDays(cursor, 7 * delta);
    else if (mode === 'day') cursor = addDays(cursor, delta);
    else cursor = addDays(cursor, AGENDA_DAYS * delta);
    draw();
  }

  function draw() {
    prevBtn.setAttribute('aria-label', nav[mode][0]);
    nextBtn.setAttribute('aria-label', nav[mode][1]);
    sheet.hidden = mode !== 'month';
    if (mode === 'month') drawMonth();
    else if (mode === 'week') drawWeek();
    else if (mode === 'day') drawDay();
    else drawAgenda();
  }

  /* ---------- month ---------- */
  function drawMonth() {
    const p = parseISODate(cursor);
    title.textContent = formatMonthYear(p.y, p.m);
    const cells = monthGrid(p.y, p.m, 1);
    const events = getOccurrencesBetween(cells[0].iso, cells.at(-1).iso, today);
    const index = indexByDate(events);
    body.replaceChildren(
      calendarGrid({
        year: p.y,
        month: p.m,
        events,
        today,
        selected: cursor,
        onSelect: (iso) => {
          cursor = iso;
          drawMonth();
          body.querySelector(`.cal-day[data-iso="${iso}"]`)?.focus();
        },
      }),
    );
    const list = (index.get(cursor) || []).sort(byTime);
    sheet.replaceChildren(
      h('h3', { class: 'sheet-title' }, t('calendar.eventsOn', { date: formatDate(cursor, { month: 'short', day: 'numeric' }) })),
      list.length ? h('ul', { class: 'day-list' }, list.map((e) => h('li', null, eventRow(e)))) : h('p', { class: 'muted' }, t('calendar.noEvents')),
      h('a', { class: 'link-more', href: `#/new?date=${cursor}` }, t('calendar.addOnDay'), h('span', { html: icon('plus', { size: 16 }) })),
    );
  }

  /* ---------- week ---------- */
  function drawWeek() {
    const start = mondayOf(cursor);
    const end = addDays(start, 6);
    title.textContent = t('calendar.weekOf', { from: formatDate(start, { month: 'short', day: 'numeric' }), to: formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' }) });
    const index = indexByDate(getOccurrencesBetween(start, end, today));
    const names = weekdayNames(1, 'short');
    body.replaceChildren(
      h(
        'div',
        { class: 'wk', role: 'list' },
        names.map((name, i) => {
          const iso = addDays(start, i);
          const list = (index.get(iso) || []).sort(byTime);
          const day = parseISODate(iso).d;
          return h(
            'div',
            { class: `wk-day${iso === today ? ' today' : ''}${iso === cursor ? ' selected' : ''}`, role: 'listitem', 'aria-label': formatDate(iso, { dateStyle: 'full' }) },
            h('button', { type: 'button', class: 'wk-head', onclick: () => { cursor = iso; mode = 'day'; root.querySelector('.cal-layout').className = 'cal-layout mode-day'; drawTabs(); draw(); }, 'aria-label': t('calendar.weekdayNumber', { weekday: formatDate(iso, { weekday: 'long' }), day }) }, h('span', { class: 'wk-name' }, name), h('b', { class: 'wk-num' }, String(day))),
            list.length
              ? h('ul', { class: 'wk-list' }, list.map((e) => h('li', null, weekChip(e))))
              : h('p', { class: 'wk-empty', 'aria-hidden': 'true' }, '·'),
          );
        }),
      ),
    );
  }

  function weekChip(e) {
    const cat = categoryById(e.category);
    return h('a', { class: 'wk-ev', href: `#/event/${encodeURIComponent(e.id)}`, style: { '--c': cat.color } }, e.time ? h('small', null, e.time) : null, h('span', null, eventTitle(e)));
  }

  /* ---------- day ---------- */
  function drawDay() {
    title.textContent = formatDate(cursor, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const list = getOccurrencesBetween(cursor, cursor, today).sort(byTime);
    const allDay = list.filter((e) => !e.time);
    const timed = list.filter((e) => e.time);
    const group = (label, rows) => (rows.length ? h('section', { class: 'dv-group' }, h('h3', { class: 'dv-label' }, label), h('ul', { class: 'day-list' }, rows.map((e) => h('li', null, eventRow(e))))) : null);
    body.replaceChildren(
      list.length ? h('div', { class: 'dv' }, group(t('calendar.allDay'), allDay), group(t('form.time'), timed)) : h('p', { class: 'muted dv-empty' }, t('calendar.noEvents')),
      h('a', { class: 'link-more', href: `#/new?date=${cursor}` }, t('calendar.addOnDay'), h('span', { html: icon('plus', { size: 16 }) })),
    );
  }

  /* ---------- agenda ---------- */
  function drawAgenda() {
    const end = addDays(cursor, AGENDA_DAYS - 1);
    title.textContent = t('calendar.agendaRange', { from: formatDate(cursor, { month: 'short', day: 'numeric' }), to: formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' }) });
    const index = indexByDate(getOccurrencesBetween(cursor, end, today));
    const days = [...index.keys()].sort();
    if (!days.length) {
      body.replaceChildren(h('p', { class: 'muted dv-empty' }, t('calendar.noEventsRange')));
      return;
    }
    body.replaceChildren(
      h(
        'div',
        { class: 'agenda' },
        days.map((iso) =>
          h(
            'section',
            { class: 'dv-group' },
            h('h3', { class: `dv-label${iso === today ? ' today' : ''}` }, h('time', { datetime: iso }, formatDate(iso, { weekday: 'long', month: 'short', day: 'numeric' }))),
            h('ul', { class: 'day-list' }, index.get(iso).sort(byTime).map((e) => h('li', null, eventRow(e)))),
          ),
        ),
      ),
    );
  }

  drawTabs();
  draw();
  return root;
}
