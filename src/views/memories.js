import { h, emptyState } from '../components/ui.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { sceneSvg } from '../scenes/art.js';
import { past } from '../events/select.js';
import { t, formatDate } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { daysLabel } from '../components/eventCard.js';

export default function renderMemories(ctx) {
  const items = past(ctx.events, ctx.today);
  const root = h('div', { class: 'view memories' }, pageHeader(ctx, { title: t('memories.title') }), mobilePageHead(ctx, t('memories.title')));
  if (!items.length) {
    root.append(emptyState({ iconName: 'memories', title: t('memories.emptyTitle'), body: t('memories.emptyBody') }));
    return root;
  }
  root.append(
    h(
      'ul',
      { class: 'mem-grid' },
      items.map((e) =>
        h(
          'li',
          null,
          h(
            'a',
            { href: `#/event/${encodeURIComponent(e.id)}`, class: 'mem-card', 'aria-label': t('actions.open', { title: eventTitle(e) }) },
            h('span', { class: 'mem-art', html: sceneSvg(e.scene, { variant: 'card', mood: 'day', align: 'right' }) }),
            h('span', { class: 'mem-txt' }, h('b', null, eventTitle(e)), h('small', null, formatDate(e.date)), h('small', { class: 'dim' }, t('memories.ago', { when: daysLabel(e, ctx.today).replace(/^\S/, (c) => c.toLowerCase()) }))),
          ),
        ),
      ),
    ),
    h('p', { class: 'note' }, t('memories.soon')),
  );
  return root;
}
