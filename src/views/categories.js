import { h } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { countByCategory } from '../events/select.js';
import { CATEGORIES } from '../events/categories.js';
import { t } from '../i18n/index.js';

export default function renderCategories(ctx) {
  const counts = countByCategory(ctx.events);
  const max = Math.max(...CATEGORIES.map((c) => counts.get(c.id) || 0), 1);
  return h(
    'div',
    { class: 'view categories' },
    pageHeader(ctx, { title: t('categories.title') }),
    mobilePageHead(ctx, t('categories.title')),
    h(
      'ul',
      { class: 'cat-grid' },
      CATEGORIES.map((c) => {
        const n = counts.get(c.id) || 0;
        return h(
          'li',
          { class: 'cat-card', style: { '--c': c.color } },
          h('span', { class: 'cat-ico', html: icon(c.icon, { size: 26 }) }),
          h('div', { class: 'cat-txt' }, h('b', null, t(`categories.${c.id}`)), h('small', null, t('categories.count', { count: n }))),
          h('div', { class: 'meter thin', 'aria-hidden': 'true' }, h('i', { style: { width: `${(n / max) * 100}%`, background: c.color } })),
        );
      }),
    ),
    h('p', { class: 'note' }, t('categories.managerSoon')),
  );
}
