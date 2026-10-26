import { h, segmented, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { sceneSvg } from '../scenes/art.js';
import { upcoming, past, byDateAsc, byDateDesc } from '../events/select.js';
import { categoryById, categoryName, visibleCategories } from '../events/categories.js';
import { t, formatDate } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { getArchived } from '../store/events.js';
import { daysLabel } from '../components/eventCard.js';

// View state survives re-renders (language switch, store updates) within the session.
const state = { filter: 'all', sort: 'default', cat: 'all', fav: false };

const SORTS = {
  dateAsc: (a, b) => byDateAsc(a, b),
  dateDesc: (a, b) => byDateDesc(a, b),
  title: (a, b) => eventTitle(a).localeCompare(eventTitle(b)),
  added: (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || byDateAsc(a, b),
};

export default function renderTimeline(ctx) {
  const { today, events } = ctx;
  const f = ctx.query.get('f');
  if (['all', 'upcoming', 'past', 'archived'].includes(f)) state.filter = f;
  const cat = ctx.query.get('cat');
  if (cat && ['celebration', 'travel', 'work', 'health', 'personal', 'other'].includes(cat)) state.cat = cat;
  let query = (ctx.query.get('q') || '').trim();

  const list = h('ol', { class: 'tl' });
  const tabsHost = h('div');
  const count = h('p', { class: 'tl-count muted small', 'aria-live': 'polite' });
  const input = h('input', { type: 'search', class: 'input', placeholder: t('timeline.searchPlaceholder'), 'aria-label': t('timeline.searchPlaceholder'), value: query, autocomplete: 'off' });
  input.addEventListener('input', () => {
    query = input.value.trim();
    drawList();
  });

  const option = (v, label) => h('option', { value: v }, label);
  const sortEl = h('select', { class: 'input', 'aria-label': t('timeline.sort') }, option('default', t('timeline.sortDefault')), option('dateAsc', t('timeline.sortDateAsc')), option('dateDesc', t('timeline.sortDateDesc')), option('title', t('timeline.sortTitle')), option('added', t('timeline.sortAdded')));
  sortEl.value = state.sort;
  sortEl.addEventListener('change', () => {
    state.sort = sortEl.value;
    drawList();
  });
  const catEl = h('select', { class: 'input', 'aria-label': t('timeline.category') }, option('all', t('timeline.allCategories')), ...visibleCategories(state.cat).map((c) => option(c.id, categoryName(c))));
  catEl.value = state.cat;
  catEl.addEventListener('change', () => {
    state.cat = catEl.value;
    drawList();
  });
  const favBtn = h(
    'button',
    {
      type: 'button',
      class: 'chip-toggle',
      'aria-pressed': String(state.fav),
      onclick: () => {
        state.fav = !state.fav;
        favBtn.setAttribute('aria-pressed', String(state.fav));
        drawList();
      },
    },
    h('span', { html: icon('star', { size: 16 }) }),
    t('timeline.favorites'),
  );
  const clearBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn secondary small',
      hidden: true,
      onclick: () => {
        state.cat = 'all';
        state.fav = false;
        state.sort = 'default';
        query = '';
        input.value = '';
        catEl.value = 'all';
        sortEl.value = 'default';
        favBtn.setAttribute('aria-pressed', 'false');
        drawList();
      },
    },
    t('timeline.clear'),
  );

  const root = h(
    'div',
    { class: 'view timeline' },
    pageHeader(ctx, { title: t('timeline.title'), value: query }),
    mobilePageHead(ctx, t('timeline.title')),
    h('div', { class: 'tl-controls' }, tabsHost, h('div', { class: 'tl-search' }, input)),
    h('div', { class: 'tl-filters', role: 'group', 'aria-label': t('timeline.filters') }, sortEl, catEl, favBtn, clearBtn),
    count,
    list,
  );

  function source() {
    if (state.filter === 'upcoming') return upcoming(events, today);
    if (state.filter === 'past') return past(events, today);
    if (state.filter === 'archived') return getArchived(today).sort(byDateAsc);
    return [...upcoming(events, today), ...past(events, today)];
  }

  function drawTabs() {
    tabsHost.replaceChildren(
      segmented({
        label: t('timeline.title'),
        value: state.filter,
        variant: 'blue',
        onChange: (id) => {
          state.filter = id;
          drawTabs();
          drawList();
        },
        items: [
          { id: 'all', label: t('tabs.all') },
          { id: 'upcoming', label: t('tabs.upcoming') },
          { id: 'past', label: t('tabs.past') },
          { id: 'archived', label: t('timeline.archived') },
        ],
      }),
    );
  }

  function drawList() {
    const q = query.toLocaleLowerCase();
    let rows = source().filter((e) => {
      if (state.cat !== 'all' && e.category !== state.cat) return false;
      if (state.fav && !e.pinned) return false;
      if (!q) return true;
      return [eventTitle(e), e.description, e.location, categoryName(e.category)].some((s) => s && s.toLocaleLowerCase().includes(q));
    });
    if (state.sort !== 'default') rows = [...rows].sort(SORTS[state.sort]);
    const filtered = !!query || state.cat !== 'all' || state.fav || state.sort !== 'default';
    clearBtn.hidden = !filtered;
    count.textContent = t('timeline.resultCount', { count: rows.length });
    if (!rows.length) {
      const archivedTab = state.filter === 'archived';
      list.replaceChildren(h('li', null, emptyState({ iconName: 'timeline', title: archivedTab && !filtered ? t('timeline.archivedEmpty') : events.length || filtered ? t('timeline.noResults') : t('timeline.empty') })));
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
            h('span', { class: 'tl-thumb', html: sceneSvg(e.scene, { variant: 'card', mood: 'day', align: 'right', animate: false }) }),
            h(
              'span',
              { class: 'tl-txt' },
              h('b', null, eventTitle(e), e.pinned ? h('span', { class: 'tl-pin', 'aria-label': t('form.pinned'), html: icon('star', { size: 13 }) }) : null, e.recurring ? h('span', { class: 'tl-pin', 'aria-hidden': 'true', html: icon('repeat', { size: 13 }) }) : null),
              h('small', null, daysLabel(e, today)),
            ),
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
