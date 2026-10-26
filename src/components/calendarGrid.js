import { h } from './ui.js';
import { monthGrid, weekdayOf } from '../date/calendar.js';
import { weekdayNames, formatDate, t } from '../i18n/index.js';
import { categoryById } from '../events/categories.js';

/** Index events by ISO date for O(1) cell lookups. */
export function indexByDate(events) {
  const map = new Map();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return map;
}

/**
 * Month grid (Mon-first by default). onSelect(iso) is called on cell activation.
 * Returns a `.cal-grid` element: 7 weekday headers + 42 day buttons.
 */
export function calendarGrid({ year, month, events, today, selected = null, onSelect, weekStart = 1, compact = false }) {
  const byDate = indexByDate(events);
  const grid = h('div', { class: `cal-grid ${compact ? 'compact' : ''}` });
  for (const name of weekdayNames(weekStart)) grid.append(h('div', { class: 'cal-dow', 'aria-hidden': 'true' }, name));

  for (const cell of monthGrid(year, month, weekStart)) {
    const list = byDate.get(cell.iso) || [];
    const wd = weekdayOf(cell.iso);
    const cats = [...new Set(list.map((e) => e.category))].slice(0, 3);
    const label = list.length ? `${formatDate(cell.iso, { dateStyle: 'full' })}, ${t('calendar.hasEvents', { count: list.length })}` : formatDate(cell.iso, { dateStyle: 'full' });
    const btn = h(
      'button',
      {
        type: 'button',
        class: `cal-day${cell.inMonth ? '' : ' out'}${wd === 0 || wd === 6 ? ' weekend' : ''}${cell.iso === today ? ' today' : ''}`,
        'aria-label': label,
        'aria-pressed': selected ? String(cell.iso === selected) : null,
        'aria-current': cell.iso === today ? 'date' : null,
        'data-iso': cell.iso,
        onclick: () => onSelect && onSelect(cell.iso),
      },
      h('span', null, String(cell.day)),
      h('span', { class: 'dots', 'aria-hidden': 'true' }, cats.map((c) => h('i', { style: { '--d': categoryById(c).color } }))),
    );
    grid.append(btn);
  }

  // Roving tabindex: one tab stop for the whole grid, arrow keys move between days.
  const cells = [...grid.querySelectorAll('.cal-day')];
  const stop = cells.find((c) => c.dataset.iso === selected && !c.classList.contains('out')) || cells.find((c) => c.dataset.iso === today && !c.classList.contains('out')) || cells.find((c) => !c.classList.contains('out'));
  cells.forEach((c) => c.setAttribute('tabindex', c === stop ? '0' : '-1'));
  grid.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const i = cells.indexOf(document.activeElement);
    if (i < 0) return;
    let target = null;
    if (step) target = cells[i + step];
    else if (e.key === 'Home') target = cells[i - (i % 7)];
    else if (e.key === 'End') target = cells[i - (i % 7) + 6];
    if (!target) return;
    e.preventDefault();
    cells.forEach((c) => c.setAttribute('tabindex', c === target ? '0' : '-1'));
    target.focus();
  });
  return grid;
}
