// Reminder UI and the in-app scheduler. Everything is local: reminders are stored on the event,
// checked while the app is open (every 30 s, on focus and on start), and shown in the bell inbox.
// If the user allows notifications they are also raised as system notifications. A closed web app
// cannot fire anything by itself, so the dialogs say so and offer the .ics calendar export.
import { h, openModal, toast } from './ui.js';
import { icon } from './icons.js';
import { t, formatDate } from '../i18n/index.js';
import { todayISO } from '../date/calendar.js';
import { optionsFor, sanitizeReminders, remindersBetween, upcomingReminders, isTimed } from '../events/reminders.js';
import { buildIcs, icsFilename } from '../events/ics.js';
import { eventTitle } from '../store/demo.js';
import { getSeries, setReminders, listSeries } from '../store/events.js';

const INBOX_DAYS = 3;
const MAX_SYSTEM_NOTIFICATIONS = 3;

/* ---------- permission ---------- */
export function notificationState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestNotifications() {
  if (notificationState() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/* ---------- labels ---------- */
export function reminderLabel(id, ev) {
  if (id === 'atTime') return t(isTimed(ev) ? 'reminders.when.atTime' : 'reminders.when.atTimeAllDay');
  return t(`reminders.when.${id}`);
}

const pad = (n) => String(n).padStart(2, '0');
function whenText(ms) {
  const d = new Date(ms);
  return `${formatDate(todayISO(d), { month: 'short', day: 'numeric' })}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ---------- inbox (what already fired and was not marked read) ---------- */
export function inboxItems(items, prefs, now = Date.now()) {
  const from = Math.max(prefs.remindersCleared || 0, now - INBOX_DAYS * 86400000);
  return remindersBetween(items, from, now);
}

export function paintBell(count) {
  document.querySelectorAll('[data-bell]').forEach((b) => {
    b.classList.toggle('has-dot', count > 0);
    b.setAttribute('aria-label', count > 0 ? t('notify.unreadLabel', { count }) : t('actions.notifications'));
  });
}

/* ---------- scheduler ---------- */
async function raise(title, body, tag, hash) {
  const options = { body, tag, icon: './assets/icons/icon-192.png', badge: './assets/icons/icon-192.png', data: { hash } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) return await reg.showNotification(title, options);
    new Notification(title, options);
  } catch {
    /* a blocked or unsupported notification must never break the app */
  }
}

function announce(due) {
  if (notificationState() !== 'granted') return;
  if (due.length > MAX_SYSTEM_NOTIFICATIONS) {
    raise(t('notify.summaryTitle'), t('notify.summaryBody', { count: due.length }), 'countly-summary', '#/');
    return;
  }
  for (const d of due) raise(eventTitle(d.ev), `${reminderLabel(d.id, d.ev)} · ${formatDate(d.ev.date)}`, d.key, `#/event/${encodeURIComponent(d.ev.id)}`);
}

/**
 * Start checking for due reminders. `save(key, value)` stores a preference without re-rendering.
 * Returns { tick, stop }. Safe against clock changes: a last-check time in the future is reset.
 */
export function startReminders({ getItems, getPrefs, save, onChange }) {
  function tick() {
    const now = Date.now();
    let last = getPrefs().reminderCheck;
    if (!last || last > now) last = now;
    const due = remindersBetween(getItems(), last, now);
    save('reminderCheck', now);
    if (due.length) announce(due);
    onChange(due.length);
  }
  const onVisible = () => document.visibilityState === 'visible' && tick();
  const timer = setInterval(tick, 30000);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', tick);
  tick();
  return {
    tick,
    stop() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    },
  };
}

/* ---------- picker (form + dialog) ---------- */
/** Checkbox group of reminder options. `setTimed()` re-filters when the event gains/loses a clock time. */
export function reminderPicker({ selected = [], time = null, onChange = () => {} }) {
  let current = { time };
  let chosen = new Set(selected);
  const box = h('div', { class: 'rm-opts', role: 'group', 'aria-labelledby': 'rm-legend' });
  function draw() {
    const ev = { time: current.time };
    chosen = new Set(sanitizeReminders([...chosen], ev));
    box.replaceChildren(
      ...optionsFor(ev).map((o) => {
        const input = h('input', { type: 'checkbox', id: `rm-${o.id}`, value: o.id, checked: chosen.has(o.id) });
        input.addEventListener('change', () => {
          if (input.checked) chosen.add(o.id);
          else chosen.delete(o.id);
          onChange([...chosen]);
        });
        return h('label', { class: 'rm-opt', for: `rm-${o.id}` }, input, h('span', null, reminderLabel(o.id, ev)));
      }),
    );
  }
  draw();
  return {
    node: box,
    get: () => sanitizeReminders([...chosen], { time: current.time }),
    setTime(next) {
      if (isTimed(current) === isTimed({ time: next })) {
        current = { time: next };
        return;
      }
      current = { time: next };
      draw();
      onChange([...chosen]);
    },
  };
}

/* ---------- calendar export ---------- */
export function downloadIcs(records, filename, name) {
  const url = URL.createObjectURL(new Blob([buildIcs(records, { name })], { type: 'text/calendar;charset=utf-8' }));
  const a = h('a', { href: url, download: filename, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ---------- permission block ---------- */
export function permissionBlock(onChanged = () => {}) {
  const state = notificationState();
  const wrap = h('div', { class: 'rm-perm' });
  const msg = { unsupported: 'reminders.permUnsupported', denied: 'reminders.permDenied', granted: 'reminders.permGranted', default: 'reminders.permDefault' }[state];
  wrap.append(h('p', { class: 'muted small' }, t(msg)));
  if (state === 'default') {
    wrap.append(
      h('button', { type: 'button', class: 'btn secondary small', onclick: async () => { const r = await requestNotifications(); toast(t(r === 'granted' ? 'reminders.permEnabled' : 'reminders.permNotEnabled')); onChanged(); } }, t('reminders.enable')),
    );
  }
  return wrap;
}

/* ---------- dialogs ---------- */
/** Detail page "Reminder" action. */
export function openReminderDialog(ev, ctx) {
  const rec = ev.userEvent ? getSeries(ev.seriesId) : null;
  if (!rec) {
    openModal({ title: t('reminders.title'), content: [h('p', { class: 'confirm-body' }, t('reminders.sampleNote'))], actions: [{ label: t('actions.gotIt') }] });
    return;
  }
  const picker = reminderPicker({ selected: rec.reminders, time: rec.time });
  const perm = h('div');
  const drawPerm = () => perm.replaceChildren(permissionBlock(drawPerm));
  drawPerm();
  openModal({
    title: t('reminders.title'),
    content: [
      h('p', { class: 'muted small', id: 'rm-legend' }, t('reminders.help', { title: eventTitle(ev) })),
      picker.node,
      perm,
      h('div', { class: 'rm-cal' }, h('button', { type: 'button', class: 'btn secondary small', onclick: () => downloadIcs([getSeries(ev.seriesId)], icsFilename(rec.title), rec.title) }, h('span', { html: icon('calendar', { size: 16 }) }), t('reminders.addToCalendar')), h('small', { class: 'muted' }, t('reminders.calendarHelp'))),
    ],
    actions: [
      { label: t('actions.cancel'), variant: 'secondary' },
      {
        label: t('actions.saveChanges'),
        onClick: async (close) => {
          try {
            await setReminders(ev.seriesId, picker.get());
            close();
            toast(t('reminders.saved'));
          } catch {
            toast(t('toast.saveFailed'));
          }
        },
      },
    ],
  });
}

/** Bell: reminders that fired, what is coming, and a way to mark read. */
export function openNotificationsDialog({ getItems, getPrefs, save, onRead, navigate }) {
  const items = getItems();
  const now = Date.now();
  const fired = inboxItems(items, getPrefs(), now).reverse();
  const soon = upcomingReminders(items, now);
  const row = (d, past) =>
    h(
      'li',
      { class: 'nf-row' },
      h('a', { href: `#/event/${encodeURIComponent(d.ev.id)}`, onclick: () => ui.close() }, h('b', null, eventTitle(d.ev)), h('small', null, `${reminderLabel(d.id, d.ev)} · ${past ? whenText(d.at) : whenText(d.at)}`)),
    );
  const content = [];
  if (fired.length) content.push(h('h3', { class: 'nf-h' }, t('notify.fired')), h('ul', { class: 'nf-list' }, fired.map((d) => row(d, true))));
  if (soon.length) content.push(h('h3', { class: 'nf-h' }, t('notify.soon')), h('ul', { class: 'nf-list' }, soon.map((d) => row(d, false))));
  if (!fired.length && !soon.length) content.push(h('div', { class: 'notify-empty' }, h('p', { class: 'empty-title' }, t('notify.emptyTitle')), h('p', null, t('notify.body'))));
  const actions = [];
  if (fired.length) actions.push({ label: t('notify.markRead'), variant: 'secondary', onClick: (close) => { save('remindersCleared', Date.now()); onRead(); close(); } });
  actions.push({ label: t('notify.settings'), variant: 'secondary', onClick: (close) => { close(); navigate('#/settings'); } }, { label: t('actions.gotIt') });
  const ui = openModal({ title: t('notify.title'), content, actions });
  return ui;
}

/** Settings → Notifications. */
export function openNotificationSettings() {
  const perm = h('div');
  const draw = () => perm.replaceChildren(permissionBlock(draw));
  draw();
  openModal({
    title: t('reminders.settingsTitle'),
    content: [h('p', { class: 'confirm-body' }, t('reminders.limits')), perm, h('p', { class: 'muted small' }, t('reminders.iosNote'))],
    actions: [{ label: t('actions.gotIt') }],
  });
}

export function exportAllToCalendar() {
  const all = listSeries().filter((s) => !s.archived);
  if (!all.length) return toast(t('reminders.nothingToExport'));
  downloadIcs(all, 'countly-events.ics', 'Countly');
  toast(t('reminders.exported'));
}
