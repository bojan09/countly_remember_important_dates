import { h, emptyState, openModal, toast, confirmDialog, sampleBadge } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { sceneSvg } from '../scenes/art.js';
import { progress } from '../date/calendar.js';
import { categoryById } from '../events/categories.js';
import { recurrenceSummary, timeLine } from '../events/format.js';
import { t, formatDate, formatNumber, unit } from '../i18n/index.js';
import { eventTitle, eventNotes } from '../store/demo.js';
import { daysLabel, daysCounter, liveCountdown } from '../components/eventCard.js';
import { celebrationBurst } from '../components/roll.js';
import { getSeries, removeEvent, restoreRemoved, duplicateEvent, setArchived, setPinned, setSkipped, setOverride, listPhotos, addPhoto, getPhotoBlob, removePhoto } from '../store/events.js';

const PHOTO_SCENES = ['car', 'coast', 'birthday'];
const failed = (err) => {
  console.error(err);
  toast(t('toast.saveFailed'));
};

export default function renderDetail(ctx, id) {
  const ev = ctx.getEvent(id);
  if (!ev) {
    return h(
      'div',
      { class: 'view detail' },
      emptyState({ iconName: 'calendar', title: t('detail.notFound'), body: t('detail.notFoundBody'), action: h('a', { href: '#/', class: 'btn primary' }, t('nav.home')) }),
    );
  }
  const mine = !!ev.userEvent;
  const series = mine ? getSeries(ev.seriesId) : null;
  const cat = categoryById(ev.category);
  const title = eventTitle(ev);
  const isPast = ev.date < ctx.today;
  const prog = isPast ? null : progress(ev.start, ev.date, ctx.today);
  const notes = eventNotes(ev);
  const skipped = !!(series && series.skips.includes(ev.date));
  const repeat = mine ? recurrenceSummary(ev.recurrence) : '';
  const when = timeLine(ev);

  /* ---------- actions ---------- */
  async function doDelete() {
    const ok = await confirmDialog({ title: t('detail.deleteTitle'), body: t('detail.deleteBody', { title: ev.title }), confirmLabel: t('actions.confirmDelete'), danger: true });
    if (!ok) return;
    try {
      ctx.navigate('#/');
      const snap = await removeEvent(ev.seriesId);
      toast(t('detail.deleted'), {
        action: {
          label: t('actions.undo'),
          onClick: () => restoreRemoved(snap).then(() => toast(t('toast.eventSaved')), failed),
        },
      });
    } catch (err) {
      failed(err);
    }
  }

  async function doDuplicate() {
    try {
      const copy = await duplicateEvent(ev);
      if (copy) {
        toast(t('detail.duplicated'));
        ctx.navigate(`#/edit/${encodeURIComponent(copy.id)}`);
      }
    } catch (err) {
      failed(err);
    }
  }

  const run = (fn, msg) => async () => {
    try {
      await fn();
      if (msg) toast(msg);
    } catch (err) {
      failed(err);
    }
  };

  function openOccurrence() {
    const titleIn = h('input', { class: 'input', id: 'occ-title', type: 'text', maxlength: '80', value: series.overrides[ev.date]?.title || '' });
    const notesIn = h('textarea', { class: 'input textarea', id: 'occ-notes', rows: '3', maxlength: '5000' });
    notesIn.value = series.overrides[ev.date]?.notes || '';
    const body = h(
      'div',
      { class: 'form paper' },
      h('p', { class: 'muted' }, t('detail.occurrenceHelp', { date: formatDate(ev.date) })),
      h('div', { class: 'field' }, h('label', { for: 'occ-title' }, t('detail.occTitleLabel')), titleIn),
      h('div', { class: 'field' }, h('label', { for: 'occ-notes' }, t('detail.occNotesLabel')), notesIn),
    );
    const actions = [
      {
        label: t('actions.saveChanges'),
        onClick: (close) =>
          run(async () => {
            await setOverride(ev.seriesId, ev.date, { title: titleIn.value, notes: notesIn.value });
            close();
          }, t('detail.occurrenceSaved'))(),
      },
    ];
    if (ev.overridden) actions.unshift({ label: t('actions.reset'), variant: 'secondary', onClick: (close) => run(async () => { await setOverride(ev.seriesId, ev.date, null); close(); }, t('detail.occurrenceSaved'))() });
    openModal({ title: t('detail.occurrenceTitle'), content: body, actions });
  }

  function openMore() {
    let modal;
    const item = (ic, label, fn, { danger = false } = {}) =>
      h('li', null, h('button', { type: 'button', class: `row more-row${danger ? ' danger' : ''}`, onclick: () => { modal.close(); fn(); } }, h('span', { class: 'row-ico', html: icon(ic, { size: 22 }) }), h('span', { class: 'grow' }, label)));
    const items = [];
    if (!mine) {
      items.push(item('copy', t('actions.makeCopy'), doDuplicate));
    } else {
      items.push(item('star', ev.pinned ? t('actions.unpin') : t('actions.pin'), run(() => setPinned(ev.seriesId, !series.pinned), series.pinned ? t('detail.unpinnedMsg') : t('detail.pinnedMsg'))));
      items.push(item('copy', t('actions.duplicate'), doDuplicate));
      if (ev.recurring) {
        items.push(item('pencil', t('actions.editOccurrence'), openOccurrence));
        items.push(item('repeat', skipped ? t('actions.unskipOccurrence') : t('actions.skipOccurrence'), run(() => setSkipped(ev.seriesId, ev.date, !skipped), skipped ? t('detail.unskippedMsg') : t('detail.skippedMsg'))));
      }
      items.push(item('archive', series.archived ? t('actions.unarchive') : t('actions.archive'), run(() => setArchived(ev.seriesId, !series.archived), series.archived ? t('detail.unarchivedMsg') : t('detail.archivedMsg'))));
      items.push(item('trash', t('actions.delete'), doDelete, { danger: true }));
    }
    modal = openModal({ title: t('detail.moreTitle'), content: h('ul', { class: 'more-list' }, items), variant: 'sheet' });
  }

  /* ---------- hero ---------- */
  const editHref = mine ? `#/edit/${encodeURIComponent(ev.seriesId)}` : null;
  const topBtn = (ic, label, props) => h('button', { type: 'button', class: 'icon-btn glass', 'aria-label': label, html: icon(ic, { size: 20 }), ...props });
  const heroEl = h(
    'div',
    { class: 'd-hero' },
    h('div', { class: 'art', html: sceneSvg(ev.scene, { variant: 'hero', mood: 'sunset', label: t(`scene.${ev.scene}`) }) }),
    ev.date === ctx.today ? celebrationBurst(`${ev.id}|${ev.date}`, h) : null,
    h(
      'div',
      { class: 'd-top' },
      h('button', { type: 'button', class: 'icon-btn glass', 'aria-label': t('nav.back'), onclick: () => ctx.goBack(), html: icon('chevronLeft', { size: 22 }) }),
      h('div', { class: 'd-top-r' }, topBtn('pencil', t('actions.edit'), mine ? { onclick: () => ctx.navigate(editHref) } : { disabled: true }), topBtn('trash', t('actions.delete'), mine ? { onclick: doDelete } : { disabled: true })),
    ),
  );

  const action = (ic, label, props = { disabled: true }) => h('div', { class: 'd-act' }, h('button', { type: 'button', class: 'd-act-btn', 'aria-label': label, html: icon(ic, { size: 22 }), ...props }), h('small', null, label));

  /* ---------- sheet ---------- */
  const badges = [ev.sample ? sampleBadge() : null, ev.archived ? h('span', { class: 'badge-sample alt' }, t('detail.archivedBadge')) : null].filter(Boolean);
  const meta = [
    when ? h('li', null, h('span', { html: icon('clock', { size: 16 }) }), h('span', null, when)) : null,
    ev.location ? h('li', null, h('span', { html: icon('mapPin', { size: 16 }) }), h('span', null, ev.location)) : null,
    repeat ? h('li', null, h('span', { html: icon('repeat', { size: 16 }) }), h('span', null, repeat)) : null,
  ].filter(Boolean);

  const sheet = h(
    'div',
    { class: 'd-sheet', style: { '--cat': cat.color } },
    h('h1', { class: 'd-title' }, title, ev.emoji ? h('span', { 'aria-hidden': 'true' }, ` ${ev.emoji}`) : null, ...badges),
    ev.description ? h('p', { class: 'd-desc' }, ev.description) : null,
    skipped ? h('p', { class: 'd-skip' }, t('detail.skippedNote')) : null,
    daysCounter(ev, ctx.today, 'd-days'),
    isPast ? null : liveCountdown(ev, 'live-left d-live', { seconds: true }),
    h('div', { class: 'd-date' }, formatDate(ev.date, { year: 'numeric', month: 'short', day: 'numeric' })),
    h('div', { class: 'd-wd' }, formatDate(ev.date, { weekday: 'long' })),
    meta.length ? h('ul', { class: 'd-meta' }, meta) : null,
    ev.recurring && isPast ? h('a', { class: 'link-more d-series', href: `#/event/${encodeURIComponent(ev.seriesId)}` }, t('detail.openSeries')) : null,
    isPast
      ? null
      : prog
        ? h('div', null, h('div', { class: 'meter d-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(prog.percent), 'aria-label': t('home.percentComplete', { percent: prog.percent }) }, h('i', { style: { width: `${prog.percent}%` } })), h('div', { class: 'meter-labels' }, h('span', null, t('home.percentComplete', { percent: prog.percent })), h('span', null, t('detail.daysLeftOf', { remaining: formatNumber(prog.remaining), total: formatNumber(prog.total), unit: unit('day', prog.total) }))))
        : h('p', { class: 'meter-labels' }, t('home.noProgress')),
    h(
      'div',
      { class: 'd-acts' },
      action('bell', t('actions.reminder')),
      action('share', t('actions.share')),
      mine ? action('pencil', t('actions.edit'), { onclick: () => ctx.navigate(editHref) }) : action('copy', t('actions.makeCopy'), { onclick: doDuplicate }),
      action('more', t('actions.more'), { onclick: openMore, 'aria-haspopup': 'dialog' }),
    ),
    h('p', { class: 'd-soon' }, ev.sample ? t('detail.sampleReadOnly') : t('detail.soon')),
    h('section', { class: 'd-notes' }, h('h2', null, t('detail.notes')), h('p', null, notes || t('detail.noNotes'))),
    mine ? photoSection(ev) : ev.photos ? samplePhotos(ev) : null,
  );

  return h('div', { class: 'view detail' }, h('article', { class: 'd-card' }, heroEl, sheet));
}

function samplePhotos(ev) {
  return h('section', { class: 'd-photos' }, h('h2', null, t('detail.photos', { count: ev.photos })), h('div', { class: 'd-thumbs' }, PHOTO_SCENES.slice(0, ev.photos).map((s) => h('span', { class: 'd-thumb', html: sceneSvg(s, { variant: 'card', mood: 'day', align: 'right', animate: false }) }))));
}

/** Local photos (Blobs in IndexedDB). Thumbnail object URLs are revoked the next time a photo section renders. */
let liveUrls = [];
function photoSection(ev) {
  liveUrls.forEach((u) => URL.revokeObjectURL(u));
  liveUrls = [];
  const urls = liveUrls;
  const metas = listPhotos(ev.seriesId);
  const input = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', id: 'photo-input', tabindex: '-1' });
  const thumbs = h('div', { class: 'd-thumbs' });

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      await addPhoto(ev.seriesId, file);
      toast(t('detail.photoAdded'));
    } catch (err) {
      const known = ['photoType', 'photoSize', 'photoCount'];
      if (known.includes(err.message)) toast(t(`detail.${err.message}`));
      else failed(err);
    }
  });

  const addBtn = h('button', { type: 'button', class: 'd-thumb add', 'aria-label': t('actions.addPhoto'), onclick: () => input.click(), html: icon('plus', { size: 26 }) });
  thumbs.append(addBtn);

  metas.forEach(async (m) => {
    const blob = await getPhotoBlob(m.id).catch(() => null);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    const img = h('img', { src: url, alt: m.name, loading: 'lazy', decoding: 'async' });
    const del = h('button', { type: 'button', class: 'thumb-del', 'aria-label': `${t('actions.removePhoto')}: ${m.name}`, html: icon('x', { size: 14 }), onclick: () => removePhoto(ev.seriesId, m.id).then(() => toast(t('detail.photoRemoved')), failed) });
    thumbs.insertBefore(h('span', { class: 'd-thumb photo' }, img, del), addBtn);
  });

  const section = h('section', { class: 'd-photos' }, h('h2', null, t('detail.photos', { count: metas.length })), thumbs, input, metas.length ? null : h('p', { class: 'muted small' }, t('detail.photosEmpty')));
  return section;
}
