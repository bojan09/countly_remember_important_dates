import { h, segmented, emptyState } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, bellButton, addEventButton } from '../components/chrome.js';
import { eventCard, daysLabel } from '../components/eventCard.js';
import { miniCalendar } from '../components/miniCalendar.js';
import { sceneSvg } from '../scenes/art.js';
import { progress } from '../date/calendar.js';
import { upcoming, thisMonth, past, featuredEvent } from '../events/select.js';
import { CATEGORIES } from '../events/categories.js';
import { t, getLang, greetingKey, formatDate, formatNumber, unit } from '../i18n/index.js';
import { eventTitle } from '../store/demo.js';
import { logoMark } from '../components/logo.js';

let tab = 'upcoming'; // remembered across renders

export default function renderHome(ctx) {
  const { events, today, prefs } = ctx;
  const up = upcoming(events, today);
  const month = thisMonth(events, today);
  const pst = past(events, today);

  const root = h('div', { class: 'view home' });

  if (!events.length) {
    root.append(
      h('div', { class: 'only-desktop' }, pageHeader(ctx, { title: greeting(prefs), sub: t('greeting.sub') })),
      emptyState({
        iconName: 'calendar',
        title: t('home.emptyTitle'),
        body: t('home.emptyBody'),
        action: h('div', { class: 'empty-actions' }, addEventButton(), h('button', { type: 'button', class: 'btn secondary', onclick: () => ctx.setPref('showSamples', true) }, t('actions.showSamples'))),
      }),
    );
    return root;
  }

  root.append(desktop(ctx, { up, month, pst }), mobile(ctx, { up, month, pst }));
  return root;
}

function greeting(prefs) {
  const g = t(greetingKey(new Date().getHours()));
  return prefs.name ? t('greeting.withName', { greeting: g, name: prefs.name }) : t('greeting.plain', { greeting: g });
}

function sampleBanner(ctx) {
  return h(
    'div',
    { class: 'banner', role: 'note' },
    h('span', null, h('b', null, t('sample.banner')), ' ', t('sample.bannerBody')),
    h('button', { type: 'button', class: 'btn secondary', onclick: () => ctx.setPref('showSamples', false) }, t('actions.hideSamples')),
  );
}

function kpi(iconName, color, num, label) {
  return h(
    'div',
    { class: 'kpi', style: { '--k': color } },
    h('div', { class: 'kpi-ico', html: icon(iconName, { size: 26 }) }),
    h('div', null, h('div', { class: 'kpi-num' }, formatNumber(num)), h('div', { class: 'kpi-label' }, label)),
  );
}

function desktop(ctx, { up, month, pst }) {
  const { today, prefs } = ctx;
  const next = featuredEvent(ctx.events, today);
  const wrap = h('div', { class: 'only-desktop' });
  wrap.append(
    pageHeader(ctx, { title: greeting(prefs), sub: `${t('greeting.sub')} ✨` }),
    ...(prefs.showSamples ? [sampleBanner(ctx)] : []),
    h(
      'div',
      { class: 'kpis' },
      kpi('calendar', 'var(--cat-travel)', up.length, t('kpi.upcoming')),
      kpi('star', 'var(--gold)', month.length, t('kpi.thisMonth')),
      kpi('image', 'var(--cat-personal)', pst.length, t('kpi.past')),
      kpi('tag', 'var(--cat-health)', CATEGORIES.filter((c) => ctx.events.some((e) => e.category === c.id)).length, t('kpi.categories')),
    ),
  );

  const feature = h('div', { class: 'feature' });
  if (next) feature.append(hero(next, today));
  feature.append(miniCalendar(ctx));
  wrap.append(feature);

  const rest = up.filter((e) => !next || e.id !== next.id).slice(0, 4);
  if (rest.length) {
    wrap.append(
      h('div', { class: 'section-head' }, h('h2', null, t('home.upNext')), h('a', { class: 'link-more', href: '#/timeline' }, t('actions.viewAll'), h('span', { html: icon('arrowRight', { size: 18 }) }))),
      h('div', { class: 'tiles' }, rest.map((e) => eventCard(e, today, { variant: 'tile' }))),
    );
  }
  return wrap;
}

function hero(ev, today) {
  const prog = progress(ev.start, ev.date, today);
  const title = eventTitle(ev);
  return h(
    'section',
    { class: 'panel hero-panel', 'aria-label': t('home.nextBig') },
    h('h2', { class: 'panel-title' }, t('home.nextBig')),
    h(
      'a',
      { href: `#/event/${encodeURIComponent(ev.id)}`, class: 'hero', 'aria-label': t('actions.open', { title }) },
      h('div', { class: 'art', html: sceneSvg(ev.scene, { variant: 'wide', mood: 'sunset', align: 'right' }) }),
      h('div', { class: 'hero-body' }, h('div', { class: 'hero-title' }, title, ev.emoji ? ` ${ev.emoji}` : ''), h('div', { class: 'hero-days' }, daysLabel(ev, today)), h('div', { class: 'hero-date' }, formatDate(ev.date))),
    ),
    prog
      ? h('div', null, h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(prog.percent), 'aria-label': t('home.percentComplete', { percent: prog.percent }) }, h('i', { style: { width: `${prog.percent}%` } })), h('div', { class: 'meter-labels' }, h('span', null, t('home.percentComplete', { percent: prog.percent })), h('span', null, t('home.daysProgress', { elapsed: formatNumber(prog.elapsed), total: formatNumber(prog.total), unit: unit('day', prog.total) }))))
      : h('p', { class: 'meter-labels' }, t('home.noProgress')),
  );
}

function mobile(ctx, { up, month, pst }) {
  const wrap = h('div', { class: 'only-mobile m-home' });
  const lists = { upcoming: up, thisMonth: month, past: pst };
  const empty = { upcoming: 'home.noUpcoming', thisMonth: 'home.noThisMonth', past: 'home.noPast' };

  const header = h(
    'div',
    { class: 'm-header' },
    h('div', { class: 'm-brand' }, h('span', { html: logoMark(34) }), h('span', null, t('app.name'))),
    h('div', { class: 'm-actions' }, bellButton(ctx.openNotifications), h('a', { href: '#/timeline', class: 'icon-btn', 'aria-label': t('actions.searchLabel'), html: icon('search', { size: 22 }) }), addEventButton({ compact: true })),
  );

  const list = h('div', { class: 'cards', role: 'tabpanel', id: 'home-panel' });
  const tabs = h('div', { class: 'm-tabs' });

  function draw() {
    tabs.replaceChildren(
      segmented({
        label: t('home.list'),
        value: tab,
        onChange: (id) => {
          tab = id;
          draw();
        },
        items: [
          { id: 'upcoming', label: t('tabs.upcoming'), count: up.length },
          { id: 'thisMonth', label: t('tabs.thisMonth'), count: month.length },
          { id: 'past', label: t('tabs.past'), count: pst.length },
        ],
      }),
    );
    const items = lists[tab];
    list.replaceChildren(...(items.length ? items.map((e) => eventCard(e, ctx.today, { variant: 'wide' })) : [emptyState({ iconName: 'calendar', title: t(empty[tab]) })]));
  }
  draw();
  wrap.append(header, tabs, ...(ctx.prefs.showSamples ? [sampleBanner(ctx)] : []), list);
  return wrap;
}
