import { h, emptyState, segmented } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { sceneSvg } from '../scenes/art.js';
import { past } from '../events/select.js';
import { parseISODate } from '../date/calendar.js';
import { t, formatDate, formatNumber } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { listPhotos, getPhotoBlob } from '../store/events.js';
import { daysLabel } from '../components/eventCard.js';

// View state survives store/language re-renders within the session.
let filter = 'all';
let urls = [];

const hasNote = (e) => !!(e.reflection || (e.notes && String(e.notes).trim()));
const FILTERS = {
  all: () => true,
  photos: (e) => e.photos > 0,
  notes: hasNote,
};

export default function renderMemories(ctx) {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  const all = past(ctx.events, ctx.today);
  const root = h('div', { class: 'view memories' }, pageHeader(ctx, { title: t('memories.title') }), mobilePageHead(ctx, t('memories.title')));
  if (!all.length) {
    root.append(emptyState({ iconName: 'memories', title: t('memories.emptyTitle'), body: t('memories.emptyBody') }));
    return root;
  }

  const host = h('div', { class: 'mem-host' });
  const tabs = h('div', { class: 'mem-filter' });
  function drawTabs() {
    tabs.replaceChildren(
      segmented({
        label: t('memories.filter'),
        value: filter,
        onChange: (id) => {
          filter = id;
          drawTabs();
          draw();
        },
        items: [
          { id: 'all', label: `${t('memories.filterAll')} (${formatNumber(all.length)})` },
          { id: 'photos', label: `${t('memories.filterPhotos')} (${formatNumber(all.filter(FILTERS.photos).length)})` },
          { id: 'notes', label: `${t('memories.filterNotes')} (${formatNumber(all.filter(FILTERS.notes).length)})` },
        ],
      }),
    );
  }

  function art(e) {
    const first = e.userEvent && e.photos ? listPhotos(e.seriesId)[0] : null;
    const box = first ? h('span', { class: 'mem-art' }) : h('span', { class: 'mem-art', html: sceneSvg(e.scene, { variant: 'card', mood: 'day', align: 'right', animate: false }) });
    if (first) {
      getPhotoBlob(first.id)
        .then((blob) => {
          if (!blob || !box.isConnected) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          box.append(h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' }));
        })
        .catch(() => {});
    }
    return box;
  }

  function card(e) {
    const note = e.reflection || (e.notes ? String(e.notes) : '');
    return h(
      'li',
      null,
      h(
        'a',
        { href: `#/event/${encodeURIComponent(e.id)}`, class: 'mem-card', 'aria-label': t('actions.open', { title: eventTitle(e) }) },
        art(e),
        h(
          'span',
          { class: 'mem-txt' },
          h('b', null, eventTitle(e)),
          h('small', null, formatDate(e.date)),
          h('small', { class: 'dim' }, t('memories.ago', { when: daysLabel(e, ctx.today).replace(/^\S/, (c) => c.toLowerCase()) })),
          note ? h('span', { class: 'mem-note' }, note) : null,
          e.photos ? h('small', { class: 'mem-photos' }, h('span', { html: icon('image', { size: 14 }), 'aria-hidden': 'true' }), t('memories.photoCount', { count: formatNumber(e.photos) })) : null,
        ),
      ),
    );
  }

  function draw() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    const items = all.filter(FILTERS[filter]);
    if (!items.length) {
      host.replaceChildren(emptyState({ iconName: 'memories', title: t(`memories.empty.${filter}Title`), body: t(`memories.empty.${filter}Body`) }));
      return;
    }
    const groups = new Map();
    for (const e of items) {
      const y = parseISODate(e.date).y;
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(e);
    }
    host.replaceChildren(
      ...[...groups].map(([year, list]) => h('section', { class: 'mem-year', 'aria-labelledby': `my-${year}` }, h('h2', { id: `my-${year}`, class: 'mem-year-h' }, String(year)), h('ul', { class: 'mem-grid' }, list.map(card)))),
    );
  }

  drawTabs();
  draw();
  root.append(tabs, host);
  return root;
}
