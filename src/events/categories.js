// Default category presets. Colors are CSS custom properties so themes own the values.
export const CATEGORIES = [
  { id: 'celebration', color: 'var(--cat-celebration)', icon: 'cake' },
  { id: 'travel', color: 'var(--cat-travel)', icon: 'plane' },
  { id: 'work', color: 'var(--cat-work)', icon: 'briefcase' },
  { id: 'health', color: 'var(--cat-health)', icon: 'heart' },
  { id: 'personal', color: 'var(--cat-personal)', icon: 'user' },
];

export function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || { id: 'other', color: 'var(--cat-other)', icon: 'tag' };
}
