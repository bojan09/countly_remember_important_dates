import { h, emptyState } from '../components/ui.js';
import { mobilePageHead } from '../components/chrome.js';
import { t } from '../i18n/index.js';

// Honest placeholder: event creation ships in Phase 2. Nothing here pretends to save data.
export default function renderCreate(ctx) {
  return h(
    'div',
    { class: 'view create' },
    mobilePageHead(ctx, t('create.title')),
    h('div', { class: 'only-desktop create-head' }, h('h1', null, t('create.title'))),
    emptyState({
      iconName: 'calendar',
      title: t('create.soonTitle'),
      body: t('create.soonBody'),
      action: h('a', { href: '#/', class: 'btn primary' }, t('nav.home')),
    }),
  );
}
