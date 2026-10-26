import { h, segmented, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { sceneSvg } from '../scenes/art.js';
import { upcoming, past } from '../events/select.js';
import { categoryById } from '../events/categories.js';
import { t, formatDate } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { daysLabel } from '../components/eventCard.js';

let filter = 'all';

export default function renderTimeline(ctx) {
  const { today, events } = ctx;
  let query = (ctx.query.get('q') || '').trim();

  const list = h('ol', { class: 'tl' });
  const tabsHost = h('div');
  const input = h('input', { type: 'search', class: 'input', placeholder: t('timeline.searchPlaceholder'), 'aria-label': t('timeline.searchPlaceholder'), value: query, autocomplete: 'off' });
  input.addEventListener('input', () => {
    query = input.value.trim();
    drawList();
  });

  const root = h(
    'div',
    { class: 'view timeline' },
    pageHeader(ctx, { title: t('timeline.title'), value: query }),
    mobilePageHead(ctx, t('timeline.title')),
    h('div', { class: 'tl-controls' }, tabsHost, h('div', { class: 'tl-search' }, input)),
    list,
  );

  function source() {
    if (filter === 'upcoming') return upcoming(events, today);
    if (filter === 'past') return past(events, today);
    return [...upcoming(events, today), ...past(events, today)];
  }

  function drawTabs() {
    tabsHost.replaceChildren(
      segmented({
        label: t('timeline.title'),
        value: filter,
        variant: 'blue',
        onChange: (id) => {
          filter = id;
          drawTabs();
          drawList();
        },
        items: [
          { id: 'all', label: t('tabs.all') },
          { id: 'upcoming', label: t('tabs.upcoming') },
          { id: 'past', label: t('tabs.past') },
        ],
      }),
    );
  }

  function drawList() {
    const q = query.toLocaleLowerCase();
    const rows = source().filter((e) => !q || eventTitle(e).toLocaleLowerCase().includes(q));
    if (!rows.length) {
      list.replaceChildren(h('li', null, emptyState({ iconName: 'timeline', title: events.length ? t('timeline.noResults') : t('timeline.empty') })));
      return;
    }
    list.replaceChildren(
      ...rows.map((e) => {
        const cat = categoryById(e.category);
        return h(
          'li',
          { class: 'tl-item', style: { '--c': cat.color } },
          h('span', { class: 'tl-dot', html: icon(cat.icon, { size: 14 }), 'aria-hidden': 'true' }),
          h('time', { class: 'tl-date', datetime: e.date }, formatDate(e.date, { year: 'numeric', month: 'short', day: 'numeric' })),
          h(
            'a',
            { href: `#/event/${encodeURIComponent(e.id)}`, class: 'tl-card', 'aria-label': t('actions.open', { title: eventTitle(e) }) },
            h('span', { class: 'tl-thumb', html: sceneSvg(e.scene, { variant: 'card', mood: 'day', align: 'right' }) }),
            h('span', { class: 'tl-txt' }, h('b', null, eventTitle(e)), h('small', null, daysLabel(e, today))),
            h('span', { class: 'chev', 'aria-hidden': 'true', html: icon('chevronRight', { size: 20 }) }),
          ),
        );
      }),
    );
  }
  drawTabs();
  drawList();
  return root;
}
