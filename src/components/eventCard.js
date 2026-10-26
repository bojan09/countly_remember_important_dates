import { h } from './ui.js';
import { icon } from './icons.js';
import { sceneSvg } from '../scenes/art.js';
import { countdown, progress } from '../date/calendar.js';
import { t, unit, formatDays, formatNumber, formatDate } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';

// Text tone per scene so copy stays readable on the art underneath.
const TONE = {
  wide: { birthday: 'dark', beach: 'dark', tooth: 'dark', car: 'light', coast: 'light', laptop: 'light', mountain: 'dark' },
  tile: { birthday: 'dark', beach: 'light', tooth: 'dark', car: 'light', coast: 'light', laptop: 'light', mountain: 'dark' },
};

export function daysLabel(ev, today) {
  const cd = countdown(ev.date, today);
  if (cd.state === 'today') return t('rel.todayBang');
  if (cd.state === 'upcoming') return formatDays(cd.days);
  if (cd.state === 'past') return t('rel.daysAgo', { count: formatNumber(cd.days), unit: unit('day', cd.days) });
  return '';
}

/** variant: 'wide' (mobile gallery) | 'tile' (desktop row) */
export function eventCard(ev, today, { variant = 'wide' } = {}) {
  const title = eventTitle(ev);
  const scene = ev.scene;
  const art = sceneSvg(scene, {
    variant: 'card',
    mood: variant === 'wide' ? 'day' : 'sunset',
    align: variant === 'wide' && scene === 'tooth' ? 'left' : 'right',
    fit: variant === 'wide' && scene === 'tooth' ? 'xMinYMid slice' : 'xMaxYMid slice',
  });
  const bodyRight = variant === 'wide' && scene === 'tooth';
  const prog = variant === 'wide' ? progress(ev.start, ev.date, today) : null;

  return h(
    'a',
    {
      href: `#/event/${encodeURIComponent(ev.id)}`,
      class: `ecard ${variant === 'tile' ? 'tile' : ''} ${bodyRight ? 'body-right' : ''}`,
      'data-tone': TONE[variant][scene] || 'dark',
      'data-scene': scene,
      'aria-label': t('actions.open', { title }),
    },
    h('div', { class: 'art', html: art }),
    h(
      'div',
      { class: 'ecard-body' },
      h('div', { class: 'ecard-title' }, h('span', null, title), ev.emoji ? h('span', { 'aria-hidden': 'true' }, ev.emoji) : null),
      h('div', { class: 'ecard-days' }, daysLabel(ev, today)),
      h('div', { class: 'ecard-date' }, formatDate(ev.date)),
    ),
    prog ? h('div', { class: 'ecard-progress', role: 'presentation' }, h('i', { style: { width: `${prog.percent}%` } })) : null,
    variant === 'wide' ? h('span', { class: 'ecard-go', 'aria-hidden': 'true', html: icon('arrowRight', { size: 22 }) }) : null,
  );
}
