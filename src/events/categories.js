// Categories: five built-in presets (+ the fallback "other") and user-made ones.
// This module is a small registry the store configures after loading; everything else reads it
// synchronously. Built-ins keep their translated names and theme colour tokens; custom
// categories carry their own name, colour, icon and default scene.
import { t } from '../i18n/index.js';

export const CATEGORIES = [
  { id: 'celebration', color: 'var(--cat-celebration)', icon: 'cake' },
  { id: 'travel', color: 'var(--cat-travel)', icon: 'plane' },
  { id: 'work', color: 'var(--cat-work)', icon: 'briefcase' },
  { id: 'health', color: 'var(--cat-health)', icon: 'heart' },
  { id: 'personal', color: 'var(--cat-personal)', icon: 'user' },
];
export const OTHER = { id: 'other', color: 'var(--cat-other)', icon: 'tag' };
export const BUILTIN_IDS = [...CATEGORIES.map((c) => c.id), OTHER.id];

export const CATEGORY_LIMITS = { name: 30, custom: 40 };
export const CATEGORY_COLORS = ['#ff5fa2', '#4da3ff', '#ff9f43', '#2ec4b6', '#a56bff', '#f2c230', '#6fcf6f', '#ff6b6b', '#4dd0e1', '#b58cff'];
export const CATEGORY_ICONS = ['tag', 'star', 'cake', 'plane', 'briefcase', 'heart', 'user', 'home', 'image', 'sparkle', 'globe', 'mapPin', 'shield', 'calendar'];

let custom = []; // [{id,name,color,icon,scene,createdAt,updatedAt}]
let order = []; // ids in the user's order (partial lists are fine)
let hidden = new Set();

/** Called by the store after load and after every category change. */
export function configureCategories({ custom: list = [], order: ord = [], hidden: hid = [] } = {}) {
  custom = list.map((c) => ({ ...c, builtin: false }));
  order = [...ord];
  hidden = new Set(hid);
}

export const customCategories = () => custom;
export const categoryPrefs = () => ({ order: [...order], hidden: [...hidden] });
export const isKnownCategory = (id) => BUILTIN_IDS.includes(id) || custom.some((c) => c.id === id);

/** Every category in display order; "other" stays last unless the user moved it. */
export function allCategories() {
  const base = [...CATEGORIES.map((c) => ({ ...c, builtin: true })), ...custom, { ...OTHER, builtin: true }];
  const rank = (c) => {
    const i = order.indexOf(c.id);
    return i === -1 ? order.length + base.indexOf(c) : i;
  };
  return base.map((c) => ({ ...c, hidden: hidden.has(c.id) && c.id !== 'other' })).sort((a, b) => rank(a) - rank(b));
}

/** Categories offered when creating/filtering. A hidden one stays visible if `keep` names it. */
export function visibleCategories(keep = null) {
  return allCategories().filter((c) => !c.hidden || c.id === keep);
}

export function categoryById(id) {
  return allCategories().find((c) => c.id === id) || { ...OTHER, builtin: true, hidden: false };
}

export function categoryName(cat) {
  const c = typeof cat === 'string' ? categoryById(cat) : cat;
  return c.builtin ? t(`categories.${c.id}`) : c.name;
}

export function newCategoryId() {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `cat-${rand}`;
}

const clean = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');

/**
 * Validate a custom category. `ctx.sceneIds` is the allowed scene list; `ctx.others` the other
 * categories (for the unique-name rule). Returns { ok, errors, value }.
 */
export function validateCategory(input, { sceneIds, selfId = null } = {}) {
  const i = input || {};
  const errors = {};
  const name = clean(i.name);
  if (!name) errors.name = 'nameRequired';
  else if ([...name].length > CATEGORY_LIMITS.name) errors.name = 'nameTooLong';
  else if (allCategories().some((c) => c.id !== selfId && categoryName(c).toLocaleLowerCase() === name.toLocaleLowerCase())) errors.name = 'nameTaken';
  const color = CATEGORY_COLORS.includes(i.color) ? i.color : CATEGORY_COLORS[0];
  const icon = CATEGORY_ICONS.includes(i.icon) ? i.icon : 'tag';
  const scene = sceneIds && sceneIds.includes(i.scene) ? i.scene : 'mountain';
  if (!selfId && custom.length >= CATEGORY_LIMITS.custom) errors.name = 'tooMany';
  return { ok: Object.keys(errors).length === 0, errors, value: { name: [...name].slice(0, CATEGORY_LIMITS.name).join(''), color, icon, scene } };
}

/** Repair a stored/imported custom-category record, or null if unusable. */
export function migrateCategory(raw, sceneIds) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !/^cat-[\w-]{1,100}$/.test(raw.id)) return null;
  const name = clean(raw.name);
  if (!name) return null;
  const now = Date.now();
  return {
    id: raw.id,
    name: [...name].slice(0, CATEGORY_LIMITS.name).join(''),
    color: CATEGORY_COLORS.includes(raw.color) ? raw.color : CATEGORY_COLORS[0],
    icon: CATEGORY_ICONS.includes(raw.icon) ? raw.icon : 'tag',
    scene: sceneIds && sceneIds.includes(raw.scene) ? raw.scene : 'mountain',
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
}
