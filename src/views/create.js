import { h, emptyState, toast } from '../components/ui.js';
import { mobilePageHead } from '../components/chrome.js';
import { sceneSvg } from '../scenes/art.js';
import { t, unit } from '../i18n/index.js';
import { emptyForm, validateEvent, CATEGORY_IDS, SCENE_IDS, SCENE_FOR_CATEGORY, LIMITS } from '../events/model.js';
import { FREQS } from '../date/recurrence.js';
import { parseISODate } from '../date/calendar.js';
import { getSeries, saveEvent } from '../store/events.js';

const FALLBACK_ZONES = ['UTC', 'Europe/Skopje', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Istanbul', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];

function timeZones() {
  try {
    const list = Intl.supportedValuesOf('timeZone');
    return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    return FALLBACK_ZONES;
  }
}

const UNIT_OF = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

/** Add / edit form. `#/new` creates, `#/edit/<id>` edits the whole series. */
export default function renderCreate(ctx, id) {
  const editing = !!id;
  const existing = editing ? getSeries(id) : null;
  const title = editing ? t('create.editTitle') : t('create.title');

  if (editing && !existing) {
    return h('div', { class: 'view create' }, mobilePageHead(ctx, title, { back: true }), emptyState({ iconName: 'calendar', title: t('detail.notFound'), body: t('detail.notFoundBody'), action: h('a', { href: '#/', class: 'btn primary' }, t('nav.home')) }));
  }

  const seed = existing ? { ...existing, recurrence: { ...existing.recurrence } } : emptyForm(ctx.today);
  if (!editing && ctx.query.get('date') && parseISODate(ctx.query.get('date'))) seed.date = ctx.query.get('date');
  const data = { ...seed };
  let sceneTouched = !!existing; // keep a chosen scene when the category changes
  const fields = {};

  /* ---------- small builders ---------- */
  const errEl = (name) => h('p', { class: 'field-error', id: `err-${name}`, hidden: true });
  function row(name, label, control, { help, required } = {}) {
    const err = errEl(name);
    const helpEl = help ? h('p', { class: 'field-help', id: `help-${name}` }, help) : null;
    control.setAttribute('aria-describedby', [helpEl ? `help-${name}` : '', `err-${name}`].filter(Boolean).join(' '));
    fields[name] = { control, err };
    return h('div', { class: 'field', 'data-field': name }, h('label', { for: `f-${name}` }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), control, helpEl, err);
  }
  const input = (name, attrs = {}) => {
    const el = h('input', { class: 'input', id: `f-${name}`, name, ...attrs });
    el.value = data[name] ?? '';
    el.addEventListener('input', () => {
      data[name] = el.value;
      clearError(name);
    });
    return el;
  };
  const textarea = (name, attrs = {}) => {
    const el = h('textarea', { class: 'input textarea', id: `f-${name}`, name, ...attrs });
    el.value = data[name] ?? '';
    el.addEventListener('input', () => {
      data[name] = el.value;
      clearError(name);
    });
    return el;
  };
  const select = (name, options, value, onChange) => {
    const el = h('select', { class: 'input', id: `f-${name}`, name }, options.map(([v, label]) => h('option', { value: v }, label)));
    el.value = value;
    el.addEventListener('change', () => {
      onChange(el.value);
      clearError(name);
    });
    return el;
  };
  const sw = (idAttr, checked, labelledBy, onToggle) => {
    const b = h('button', { type: 'button', class: 'switch', id: idAttr, role: 'switch', 'aria-checked': String(checked), 'aria-labelledby': labelledBy });
    b.addEventListener('click', () => {
      const next = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(next));
      onToggle(next);
    });
    return b;
  };

  function showError(name, code) {
    const f = fields[name];
    if (!f) return;
    f.err.textContent = t(`validation.${code}`);
    f.err.hidden = false;
    f.control.setAttribute('aria-invalid', 'true');
  }
  function clearError(name) {
    const f = fields[name];
    if (!f) return;
    f.err.hidden = true;
    f.err.textContent = '';
    f.control.removeAttribute('aria-invalid');
  }

  /* ---------- fields ---------- */
  const titleRow = row('title', t('form.title'), input('title', { type: 'text', maxlength: String(LIMITS.title), placeholder: t('form.titlePh'), autocomplete: 'off', required: true }), { required: true });
  const emojiRow = row('emoji', t('form.emoji'), input('emoji', { type: 'text', maxlength: '8', autocomplete: 'off', inputmode: 'text' }));
  const dateRow = row('date', t('form.date'), input('date', { type: 'date', required: true }), { required: true });

  // all-day / timed
  const timeEl = input('time', { type: 'time' });
  timeEl.value = data.time || '';
  timeEl.addEventListener('input', () => {
    data.time = timeEl.value || null;
    if (!data.time) data.tz = null;
  });
  const zones = timeZones();
  const tzEl = select('tz', [['', t('form.tzLocal')], ...zones.map((z) => [z, z.replace(/_/g, ' ')])], data.tz || '', (v) => (data.tz = v || null));
  const timeRow = row('time', t('form.time'), timeEl);
  const tzRow = row('tz', t('form.timeZone'), tzEl, { help: t('form.tzHint') });
  const timedBox = h('div', { class: 'field-grid' }, timeRow, tzRow);
  const allDayLabel = h('span', { id: 'lbl-allday' }, t('form.allDay'));
  const allDaySwitch = sw('f-allday', !data.time, 'lbl-allday', (on) => {
    timedBox.hidden = on;
    if (on) {
      data.time = null;
      data.tz = null;
      timeEl.value = '';
      tzEl.value = '';
    } else if (!timeEl.value) {
      timeEl.value = '09:00';
      data.time = '09:00';
    }
  });
  timedBox.hidden = !data.time;
  const allDayRow = h('div', { class: 'toggle-row field' }, h('div', { class: 'grow' }, allDayLabel), allDaySwitch);

  const startRow = row('start', t('form.start'), input('start', { type: 'date' }), { help: t('form.startHelp') });

  // category + scene
  const catRow = row(
    'category',
    t('form.category'),
    select('category', CATEGORY_IDS.map((c) => [c, t(`categories.${c}`)]), data.category, (v) => {
      data.category = v;
      if (!sceneTouched) {
        data.scene = SCENE_FOR_CATEGORY[v];
        const radio = scenePicker.querySelector(`input[value="${data.scene}"]`);
        if (radio) radio.checked = true;
      }
    }),
  );
  const scenePicker = h(
    'fieldset',
    { class: 'scene-picker' },
    h('legend', null, t('form.scene')),
    h(
      'div',
      { class: 'scene-grid' },
      SCENE_IDS.map((s) => {
        const radio = h('input', { type: 'radio', name: 'scene', value: s, class: 'scene-radio' });
        radio.checked = data.scene === s;
        radio.addEventListener('change', () => {
          data.scene = s;
          sceneTouched = true;
        });
        return h('label', { class: 'scene-opt' }, radio, h('span', { class: 'scene-thumb', html: sceneSvg(s, { variant: 'card', mood: 'day', align: 'right', animate: false }) }), h('span', { class: 'sr-only' }, t(`scene.${s}`)));
      }),
    ),
  );

  // recurrence
  const rule = data.recurrence;
  const freqEl = select('freq', FREQS.map((f) => [f, t(`form.freq.${f}`)]), rule.freq, (v) => {
    rule.freq = v;
    syncRecur();
  });
  const freqRow = row('freq', t('form.repeat'), freqEl, { help: t('form.recurrenceHelp') });
  const intervalEl = h('input', { class: 'input', id: 'f-interval', name: 'interval', type: 'number', min: '1', max: '999', step: '1', inputmode: 'numeric' });
  intervalEl.value = String(rule.interval || 1);
  intervalEl.addEventListener('input', () => {
    rule.interval = intervalEl.value === '' ? NaN : Number(intervalEl.value);
    clearError('interval');
    syncUnit();
  });
  const unitEl = h('span', { class: 'unit-text' });
  const intervalRow = row('interval', t('form.every'), intervalEl);
  const endsEl = select('ends', [['never', t('form.endsNever')], ['on', t('form.endsOn')]], rule.until ? 'on' : 'never', (v) => {
    untilBox.hidden = v !== 'on';
    if (v !== 'on') rule.until = null;
    else if (!rule.until) rule.until = '';
  });
  const endsRow = row('ends', t('form.ends'), endsEl);
  const untilEl = h('input', { class: 'input', id: 'f-until', name: 'until', type: 'date' });
  untilEl.value = rule.until || '';
  untilEl.addEventListener('input', () => {
    rule.until = untilEl.value || null;
    clearError('until');
  });
  const untilRow = row('until', t('form.endDate'), untilEl);
  const untilBox = h('div', null, untilRow);
  untilBox.hidden = !rule.until && endsEl.value !== 'on';
  const recurBox = h('div', { class: 'field-grid' }, h('div', { class: 'field-inline' }, intervalRow, unitEl), endsRow);
  const recurWrap = h('div', null, recurBox, untilBox);
  function syncUnit() {
    const n = Number.isInteger(rule.interval) ? rule.interval : 1;
    unitEl.textContent = rule.freq === 'none' ? '' : unit(UNIT_OF[rule.freq], n);
  }
  function syncRecur() {
    recurWrap.hidden = rule.freq === 'none';
    syncUnit();
  }
  syncRecur();

  const locationRow = row('location', t('form.location'), input('location', { type: 'text', maxlength: String(LIMITS.location), autocomplete: 'off' }));
  const descRow = row('description', t('form.description'), input('description', { type: 'text', maxlength: String(LIMITS.description), autocomplete: 'off' }));
  const notesRow = row('notes', t('form.notes'), textarea('notes', { rows: '4', maxlength: String(LIMITS.notes) }));
  const pinLabel = h('span', { id: 'lbl-pinned' }, t('form.pinned'));
  const pinRow = h('div', { class: 'toggle-row field' }, h('div', { class: 'grow' }, pinLabel, h('small', { class: 'muted block' }, t('form.pinnedHelp'))), sw('f-pinned', !!data.pinned, 'lbl-pinned', (on) => (data.pinned = on)));

  /* ---------- submit ---------- */
  const summary = h('div', { class: 'form-summary', role: 'alert', tabindex: '-1', hidden: true });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary' }, editing ? t('actions.saveChanges') : t('actions.save'));
  const cancel = h('button', { type: 'button', class: 'btn secondary', onclick: () => ctx.goBack() }, t('actions.cancel'));

  const form = h(
    'form',
    { class: 'form paper', novalidate: true, 'aria-label': title },
    summary,
    titleRow,
    h('div', { class: 'field-grid' }, dateRow, emojiRow),
    allDayRow,
    timedBox,
    startRow,
    catRow,
    scenePicker,
    freqRow,
    recurWrap,
    locationRow,
    descRow,
    notesRow,
    pinRow,
    h('p', { class: 'muted small' }, t('create.createdHelp')),
    h('div', { class: 'form-actions' }, cancel, saveBtn),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.keys(fields).forEach(clearError);
    summary.hidden = true;
    const payload = { ...data, time: data.time || null, recurrence: { ...rule, interval: Number(rule.interval) } };
    const check = validateEvent(payload);
    if (!check.ok) {
      const names = Object.keys(check.errors);
      for (const k of names) showError(k, check.errors[k]);
      summary.textContent = t('form.errorsTitle');
      summary.hidden = false;
      const first = names.map((k) => fields[k]).find(Boolean);
      (first ? first.control : summary).focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = t('form.saving');
    try {
      const res = await saveEvent(payload, editing ? id : null);
      if (!res.ok) {
        for (const [k, code] of Object.entries(res.errors)) showError(k, code);
        summary.textContent = t('form.errorsTitle');
        summary.hidden = false;
        return;
      }
      toast(t('toast.eventSaved'));
      ctx.navigate(`#/event/${encodeURIComponent(res.event.id)}`);
    } catch (err) {
      console.error(err);
      summary.textContent = t('toast.saveFailed');
      summary.hidden = false;
      summary.focus();
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? t('actions.saveChanges') : t('actions.save');
    }
  });

  return h('div', { class: 'view create' }, mobilePageHead(ctx, title, { back: true }), h('div', { class: 'only-desktop create-head' }, h('h1', { id: 'form-title' }, title)), form);
}
