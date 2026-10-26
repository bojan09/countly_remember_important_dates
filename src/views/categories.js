import { h, openModal, confirmDialog, toast } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { pageHeader, mobilePageHead } from '../components/chrome.js';
import { countByCategory } from '../events/select.js';
import { allCategories, categoryName, CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LIMITS } from '../events/categories.js';
import { SCENE_IDS } from '../events/model.js';
import { saveCategory, removeCategory, setCategoryHidden, moveCategory } from '../store/events.js';
import { t, formatNumber } from '../i18n/index.js';

export default function renderCategories(ctx) {
  const counts = countByCategory(ctx.events);
  const cats = allCategories();
  const max = Math.max(...cats.map((c) => counts.get(c.id) || 0), 1);

  const iconBtn = (ic, label, onclick, disabled = false) => h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': label, title: label, disabled, onclick, html: icon(ic, { size: 18 }) });

  const items = cats.map((c, i) => {
    const n = counts.get(c.id) || 0;
    const name = categoryName(c);
    const isCustom = !c.builtin;
    return h(
      'li',
      { class: `cm-item${c.hidden ? ' is-hidden' : ''}`, style: { '--c': c.color }, 'data-cat': c.id },
      h('span', { class: 'cat-ico', html: icon(c.icon, { size: 24 }) }),
      h(
        'a',
        { class: 'cm-main', href: `#/timeline?cat=${encodeURIComponent(c.id)}`, 'aria-label': `${name}: ${t('categories.count', { count: n })}` },
        h('b', null, name, c.hidden ? h('span', { class: 'cm-badge' }, t('categories.hiddenBadge')) : null),
        h('small', null, t('categories.count', { count: n })),
        h('span', { class: 'meter thin', 'aria-hidden': 'true' }, h('i', { style: { width: `${(n / max) * 100}%`, background: c.color } })),
      ),
      h(
        'div',
        { class: 'cm-actions' },
        iconBtn('chevronUp', t('categories.moveUp', { name }), () => moveCategory(c.id, -1), i === 0),
        iconBtn('chevronDown', t('categories.moveDown', { name }), () => moveCategory(c.id, 1), i === cats.length - 1),
        c.id === 'other' ? null : iconBtn(c.hidden ? 'eye' : 'eyeOff', t(c.hidden ? 'categories.show' : 'categories.hide', { name }), () => setCategoryHidden(c.id, !c.hidden)),
        isCustom ? iconBtn('pencil', t('categories.edit', { name }), () => openForm(c)) : null,
        isCustom ? iconBtn('trash', t('categories.delete', { name }), () => openDelete(c, n)) : null,
      ),
    );
  });

  function openForm(existing = null) {
    const data = { name: existing ? existing.name : '', color: existing ? existing.color : CATEGORY_COLORS[allCategories().filter((c) => !c.builtin).length % CATEGORY_COLORS.length], icon: existing ? existing.icon : 'tag', scene: existing ? existing.scene : 'mountain' };
    const nameInput = h('input', { type: 'text', class: 'input', id: 'cm-name', maxlength: String(CATEGORY_LIMITS.name), value: data.name, autocomplete: 'off', 'aria-describedby': 'cm-name-err' });
    const err = h('p', { class: 'field-error', id: 'cm-name-err', role: 'alert', hidden: true });
    const radios = (label, name, values, current, render) => {
      const row = h('div', { class: 'cm-opts', role: 'radiogroup', 'aria-label': label });
      for (const v of values) {
        const b = h('button', { type: 'button', class: 'cm-opt', role: 'radio', 'aria-checked': String(current === v), ...render(v) });
        b.addEventListener('click', () => {
          data[name] = v;
          row.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        });
        row.append(b);
      }
      return row;
    };
    const colorRow = radios(t('categories.color'), 'color', CATEGORY_COLORS, data.color, (v) => ({ style: { '--sw': v }, 'aria-label': t('categories.colorN', { n: CATEGORY_COLORS.indexOf(v) + 1 }), html: icon('check', { size: 16 }) }));
    const iconRow = radios(t('categories.icon'), 'icon', CATEGORY_ICONS, data.icon, (v) => ({ 'aria-label': t(`categories.icons.${v}`), title: t(`categories.icons.${v}`), html: icon(v, { size: 20 }) }));
    const sceneSel = h('select', { class: 'input', id: 'cm-scene' }, SCENE_IDS.map((s) => h('option', { value: s, selected: s === data.scene }, t(`scene.${s}`))));
    sceneSel.addEventListener('change', () => (data.scene = sceneSel.value));

    const content = h(
      'div',
      { class: 'cm-form' },
      h('div', { class: 'field' }, h('label', { for: 'cm-name' }, t('categories.name')), nameInput, err),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('categories.color')), colorRow),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('categories.icon')), iconRow),
      h('div', { class: 'field' }, h('label', { for: 'cm-scene' }, t('categories.defaultScene')), sceneSel, h('small', { class: 'muted' }, t('categories.defaultSceneHelp'))),
    );
    const ui = openModal({
      title: existing ? t('categories.editTitle') : t('categories.newTitle'),
      content,
      actions: [
        { label: t('actions.cancel'), variant: 'secondary' },
        {
          label: t('actions.saveChanges'),
          onClick: async (close) => {
            const res = await saveCategory({ ...data, name: nameInput.value }, existing ? existing.id : null);
            if (!res.ok) {
              err.textContent = t(`categories.errors.${res.errors.name || 'nameRequired'}`, { max: CATEGORY_LIMITS.custom });
              err.hidden = false;
              nameInput.setAttribute('aria-invalid', 'true');
              nameInput.focus();
              return;
            }
            close();
            toast(t('categories.saved'));
          },
        },
      ],
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        ui.dialog.querySelector('.modal-foot .btn.primary').click();
      }
    });
    nameInput.focus();
  }

  async function openDelete(c, n) {
    const name = categoryName(c);
    if (!n) {
      if (await confirmDialog({ title: t('categories.deleteTitle', { name }), body: t('categories.deleteEmpty'), confirmLabel: t('actions.delete'), danger: true })) {
        await removeCategory(c.id, 'other');
        toast(t('categories.deleted', { name }));
      }
      return;
    }
    const targets = allCategories().filter((x) => x.id !== c.id);
    const sel = h('select', { class: 'input', id: 'cm-move' }, targets.map((x) => h('option', { value: x.id, selected: x.id === 'other' }, categoryName(x))));
    openModal({
      title: t('categories.deleteTitle', { name }),
      variant: 'confirm',
      content: [h('p', { class: 'confirm-body' }, t('categories.deleteBody', { count: formatNumber(n) })), h('div', { class: 'field' }, h('label', { for: 'cm-move' }, t('categories.moveTo')), sel)],
      actions: [
        { label: t('actions.cancel'), variant: 'secondary' },
        {
          label: t('actions.delete'),
          variant: 'danger',
          onClick: async (close) => {
            const moved = await removeCategory(c.id, sel.value);
            close();
            toast(t('categories.deletedMoved', { name, count: formatNumber(moved || 0) }));
          },
        },
      ],
    });
  }

  return h(
    'div',
    { class: 'view categories' },
    pageHeader(ctx, { title: t('categories.title') }),
    mobilePageHead(ctx, t('categories.title')),
    h('div', { class: 'cm-bar' }, h('p', { class: 'muted' }, t('categories.help')), h('button', { type: 'button', class: 'btn primary', id: 'cm-new', onclick: () => openForm() }, h('span', { html: icon('plus', { size: 18 }) }), t('categories.new'))),
    h('ul', { class: 'cm-list' }, items),
  );
}
