import { h, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { sceneSvg } from '../scenes/art.js';
import { progress } from '../date/calendar.js';
import { categoryById } from '../events/categories.js';
import { t, formatDate, formatNumber, unit } from '../i18n/index.js';
import { eventTitle, eventNotes } from '../store/demo.js';
import { daysLabel, liveCountdown } from '../components/eventCard.js';
import { sampleBadge } from '../components/ui.js';

const PHOTO_SCENES = ['car', 'coast', 'birthday'];

export default function renderDetail(ctx, id) {
  const ev = ctx.getEvent(id);
  if (!ev) {
    return h(
      'div',
      { class: 'view detail' },
      emptyState({ iconName: 'calendar', title: t('detail.notFound'), body: t('detail.notFoundBody'), action: h('a', { href: '#/', class: 'btn primary' }, t('nav.home')) }),
    );
  }
  const cat = categoryById(ev.category);
  const title = eventTitle(ev);
  const prog = progress(ev.start, ev.date, ctx.today);
  const notes = eventNotes(ev);

  const heroEl = h(
    'div',
    { class: 'd-hero' },
    h('div', { class: 'art', html: sceneSvg(ev.scene, { variant: 'hero', mood: 'sunset', label: t(`scene.${ev.scene}`) }) }),
    h('div', { class: 'd-top' }, h('button', { type: 'button', class: 'icon-btn glass', 'aria-label': t('nav.back'), onclick: () => ctx.goBack(), html: icon('chevronLeft', { size: 22 }) }), h('div', { class: 'd-top-r' }, h('button', { type: 'button', class: 'icon-btn glass', disabled: true, 'aria-label': t('actions.edit'), html: icon('pencil', { size: 20 }) }), h('button', { type: 'button', class: 'icon-btn glass', disabled: true, 'aria-label': t('actions.delete'), html: icon('trash', { size: 20 }) }))),
  );

  const action = (ic, label) => h('div', { class: 'd-act' }, h('button', { type: 'button', class: 'd-act-btn', disabled: true, 'aria-label': label, html: icon(ic, { size: 22 }) }), h('small', null, label));

  const sheet = h(
    'div',
    { class: 'd-sheet', style: { '--cat': cat.color } },
    h('h1', { class: 'd-title' }, title, ev.emoji ? h('span', { 'aria-hidden': 'true' }, ` ${ev.emoji}`) : null, ev.sample ? sampleBadge() : null),
    h('div', { class: 'd-days' }, daysLabel(ev, ctx.today)),
    liveCountdown(ev, 'live-left d-live'),
    h('div', { class: 'd-date' }, formatDate(ev.date, { year: 'numeric', month: 'short', day: 'numeric' })),
    h('div', { class: 'd-wd' }, formatDate(ev.date, { weekday: 'long' })),
    prog
      ? h('div', null, h('div', { class: 'meter d-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(prog.percent), 'aria-label': t('home.percentComplete', { percent: prog.percent }) }, h('i', { style: { width: `${prog.percent}%` } })), h('div', { class: 'meter-labels' }, h('span', null, t('home.percentComplete', { percent: prog.percent })), h('span', null, t('detail.daysLeftOf', { remaining: formatNumber(prog.remaining), total: formatNumber(prog.total), unit: unit('day', prog.total) }))))
      : h('p', { class: 'meter-labels' }, t('home.noProgress')),
    h('div', { class: 'd-acts' }, action('bell', t('actions.reminder')), action('share', t('actions.share')), action('pencil', t('actions.edit')), action('more', t('actions.more'))),
    h('p', { class: 'd-soon' }, t('detail.comingPhase2')),
    h('section', { class: 'd-notes' }, h('h2', null, t('detail.notes')), h('p', null, notes || t('detail.noNotes'))),
    ev.photos
      ? h('section', { class: 'd-photos' }, h('h2', null, t('detail.photos', { count: ev.photos })), h('div', { class: 'd-thumbs' }, PHOTO_SCENES.slice(0, ev.photos).map((s) => h('span', { class: 'd-thumb', html: sceneSvg(s, { variant: 'card', mood: 'day', align: 'right' }) })), h('button', { type: 'button', class: 'd-thumb add', disabled: true, 'aria-label': t('actions.addPhoto'), html: icon('plus', { size: 26 }) })))
      : null,
  );

  return h('div', { class: 'view detail' }, h('article', { class: 'd-card' }, heroEl, sheet));
}
