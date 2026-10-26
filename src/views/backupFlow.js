// Export / import dialogs for backups (Settings -> Your data). The format rules live in
// store/backup.js; this file is only the user flow: download, file pick, preview, confirm.
import { h, openModal, toast } from '../components/ui.js';
import { parseBackup, MAX_BACKUP_BYTES, BACKUP_PREF_KEYS } from '../store/backup.js';
import { exportBackup, importBackup, previewImport, PHOTO_LIMITS } from '../store/events.js';
import { getPrefs } from '../store/prefs.js';
import { todayISO } from '../date/calendar.js';
import { t, formatNumber } from '../i18n/index.js';

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Build the backup and hand it to the browser as a file. Returns the counts, or null on failure. */
export async function runExport(ctx, { safety = false } = {}) {
  try {
    const { text, events, photos } = await exportBackup(getPrefs());
    download(text, `countly-${safety ? 'safety-' : ''}backup-${todayISO()}.json`);
    if (!safety) {
      ctx.setPref('lastBackup', Date.now()); // re-renders Settings so the date shows
      toast(t('backup.exportDone', { events: formatNumber(events), photos: formatNumber(photos) }));
    }
    return { events, photos };
  } catch (err) {
    console.error(err);
    toast(t('backup.exportFailed'));
    return null;
  }
}

function errorDialog(key) {
  openModal({ title: t('backup.importTitle'), content: h('p', { class: 'confirm-body' }, t(`backup.errors.${key}`, { mb: MAX_BACKUP_BYTES / 1048576 })), actions: [{ label: t('actions.gotIt') }] });
}

/** Open the file picker, then the preview dialog. */
export function pickAndImport(ctx) {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return errorDialog('tooLarge');
    let text;
    try {
      text = await file.text();
    } catch {
      return errorDialog('readError');
    }
    const parsed = parseBackup(text, { maxBytes: PHOTO_LIMITS.maxBytes, maxPerEvent: PHOTO_LIMITS.maxPerEvent });
    if (!parsed.ok) return errorDialog(parsed.error);
    previewDialog(ctx, parsed);
  });
  document.body.append(input);
  input.click();
}

function previewDialog(ctx, parsed) {
  let mode = 'merge';
  const word = t('backup.replaceWord');
  const hasPrefs = BACKUP_PREF_KEYS.some((k) => k in parsed.prefs);
  const when = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : '—';
  const summary = h('p', { class: 'confirm-body' }, t('backup.summary', { events: formatNumber(parsed.events.length), photos: formatNumber(parsed.photos.length), date: when }));
  const skipped = parsed.skipped.events + parsed.skipped.photos;
  const plan = h('p', { class: 'bk-plan', role: 'status' });
  const confirmInput = h('input', { type: 'text', class: 'input', id: 'bk-confirm', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const confirmField = h('div', { class: 'field', hidden: true }, h('label', { for: 'bk-confirm' }, t('backup.typeToConfirm', { word })), confirmInput);
  const prefsBox = h('input', { type: 'checkbox', id: 'bk-prefs', checked: true });
  let ui;

  const option = (id, checked) =>
    h(
      'label',
      { class: 'bk-opt' },
      h('input', { type: 'radio', name: 'bk-mode', value: id, checked }),
      h('span', null, h('b', null, t(`backup.mode.${id}`)), h('small', { class: 'muted' }, t(`backup.mode.${id}Help`))),
    );
  const modes = h('div', { class: 'bk-modes', role: 'radiogroup', 'aria-label': t('backup.modeLabel') }, option('merge', true), option('replace', false));

  const importBtn = () => ui.dialog.querySelector('.modal-foot .btn.primary');
  function refresh() {
    const p = previewImport(parsed, mode);
    plan.textContent = mode === 'replace' ? t('backup.planReplace', { events: formatNumber(p.add.length), removed: formatNumber(p.remove.length) }) : t('backup.planMerge', { add: formatNumber(p.add.length), update: formatNumber(p.update.length), same: formatNumber(p.unchanged) });
    confirmField.hidden = mode !== 'replace';
    const ready = mode !== 'replace' || confirmInput.value.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
    importBtn().disabled = !ready;
  }
  modes.addEventListener('change', (e) => {
    if (e.target.name === 'bk-mode') {
      mode = e.target.value;
      refresh();
    }
  });
  confirmInput.addEventListener('input', refresh);

  ui = openModal({
    title: t('backup.importTitle'),
    content: [
      summary,
      skipped ? h('p', { class: 'note' }, t('backup.skipped', { count: formatNumber(skipped) })) : null,
      modes,
      plan,
      confirmField,
      hasPrefs ? h('label', { class: 'bk-opt inline' }, prefsBox, h('span', null, t('backup.restorePrefs'))) : null,
    ],
    actions: [
      { label: t('actions.cancel'), variant: 'secondary' },
      {
        label: t('backup.importButton'),
        onClick: async (close) => {
          const btn = importBtn();
          btn.disabled = true;
          if (mode === 'replace' && !(await runExport(ctx, { safety: true }))) {
            btn.disabled = false;
            return;
          }
          try {
            const res = await importBackup(parsed, mode);
            if (hasPrefs && prefsBox.checked) {
              for (const [k, v] of Object.entries(parsed.prefs)) {
                if (k === 'lang') ctx.setLang(v);
                else ctx.setPref(k, v, { silent: true });
              }
            }
            close();
            toast(mode === 'replace' ? t('backup.replaceDone', { events: formatNumber(res.added) }) : t('backup.mergeDone', { add: formatNumber(res.added), update: formatNumber(res.updated) }));
          } catch (err) {
            console.error(err);
            btn.disabled = false;
            toast(t('backup.importFailed'));
          }
        },
      },
    ],
  });
  refresh();
}
