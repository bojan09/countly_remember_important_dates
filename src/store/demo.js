// Clearly-labeled SAMPLE events (never user data). Dates are generated relative to
// "today" so every sample countdown is truthful whenever the app is opened.
import { addDays } from '../date/calendar.js';
import { t } from '../i18n/index.js';

const UPCOMING = [
  { id: 'birthday', titleKey: 'demo.birthday', offset: 11, startOffset: -354, category: 'celebration', scene: 'birthday', emoji: '🎂', notes: true, photos: 3 },
  { id: 'vacation', titleKey: 'demo.vacation', offset: 42, startOffset: -77, category: 'travel', scene: 'beach', emoji: '✈️', pinned: true },
  { id: 'dental', titleKey: 'demo.dental', offset: 5, category: 'health', scene: 'tooth' },
  { id: 'car', titleKey: 'demo.car', offset: 18, category: 'personal', scene: 'car' },
  { id: 'croatia', titleKey: 'demo.croatia', offset: 31, category: 'travel', scene: 'coast' },
  { id: 'laptop', titleKey: 'demo.laptop', offset: 65, category: 'personal', scene: 'laptop' },
  { id: 'mountain', titleKey: 'demo.mountain', offset: 24, category: 'travel', scene: 'mountain' },
  { id: 'anniversary', titleKey: 'demo.anniversary', offset: 3, category: 'celebration', scene: 'wedding' },
];

const PAST = [
  ['p1', -3, 'work', 'laptop'],
  ['p2', -9, 'celebration', 'concert'],
  ['p3', -16, 'personal', 'house'],
  ['p4', -24, 'health', 'runner'],
  ['p5', -40, 'celebration', 'graduation'],
  ['p6', -55, 'travel', 'beach'],
  ['p7', -71, 'work', 'rocket'],
  ['p8', -90, 'personal', 'coast'],
  ['p9', -120, 'health', 'tooth'],
  ['p10', -150, 'celebration', 'wedding'],
  ['p11', -200, 'travel', 'mountain'],
  ['p12', -250, 'celebration', 'fireworks'],
];

export function buildSampleEvents(todayISO) {
  const upcoming = UPCOMING.map((e) => ({
    id: `sample-${e.id}`,
    sample: true,
    titleKey: e.titleKey,
    date: addDays(todayISO, e.offset),
    start: e.startOffset != null ? addDays(todayISO, e.startOffset) : null,
    category: e.category,
    scene: e.scene,
    emoji: e.emoji || '',
    pinned: !!e.pinned,
    notesKey: e.notes ? 'demo.notes' : null,
    photos: e.photos || 0,
  }));
  const past = PAST.map(([k, offset, category, scene]) => ({
    id: `sample-past-${k}`,
    sample: true,
    titleKey: `demo.past.${k}`,
    date: addDays(todayISO, offset),
    start: null,
    category,
    scene,
    emoji: '',
    notesKey: null,
    photos: 0,
  }));
  return [...upcoming, ...past];
}

export function eventTitle(ev) {
  return ev.titleKey ? t(ev.titleKey) : ev.title;
}

export function eventNotes(ev) {
  return ev.notesKey ? t(ev.notesKey) : ev.notes || '';
}
