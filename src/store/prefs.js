// Lightweight UI preferences. localStorage is used here (and only here) because
// language, theme and accent must be known synchronously before first paint.
// Event data moves to IndexedDB in Phase 2.
const KEY = 'countly.prefs.v1';

export const ACCENTS = {
  violet: '#7356f2',
  teal: '#2ec4b6',
  orange: '#ff9f43',
  peach: '#ffb38a',
  pink: '#ff5fa2',
  blue: '#4d8dff',
  indigo: '#5b5bd6',
};

// Text color that stays readable on top of each accent (>= 4.5:1).
export const ACCENT_INK = {
  violet: '#ffffff',
  teal: '#1a0f3a',
  orange: '#1a0f3a',
  peach: '#1a0f3a',
  pink: '#1a0f3a',
  blue: '#1a0f3a',
  indigo: '#ffffff',
};

export const DEFAULT_PREFS = Object.freeze({
  lang: 'en',
  theme: 'auto', // 'light' | 'dark' | 'auto'
  accent: 'violet',
  motion: 'full', // 'full' | 'calm' | 'off'
  name: '',
  showSamples: true,
  onboarded: false,
  sidebarCollapsed: false,
  lastBackup: null, // epoch ms of the last exported backup
  reminderCheck: null, // epoch ms the reminder scheduler last looked
  remindersCleared: null, // epoch ms the bell inbox was last marked read
});

let prefs = { ...DEFAULT_PREFS };
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function sanitizePrefs(input) {
  const out = { ...DEFAULT_PREFS };
  if (input.lang === 'en' || input.lang === 'mk') out.lang = input.lang;
  if (['light', 'dark', 'auto'].includes(input.theme)) out.theme = input.theme;
  if (Object.hasOwn(ACCENTS, input.accent)) out.accent = input.accent;
  if (['full', 'calm', 'off'].includes(input.motion)) out.motion = input.motion;
  else if (input.reduceMotion === true) out.motion = 'off'; // pre-0.3 preference
  for (const k of ['showSamples', 'onboarded', 'sidebarCollapsed']) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  if (typeof input.name === 'string') out.name = input.name.slice(0, 40);
  for (const k of ['lastBackup', 'reminderCheck', 'remindersCleared']) {
    if (Number.isFinite(input[k]) && input[k] > 0) out[k] = input[k];
  }
  return out;
}

export function loadPrefs() {
  prefs = sanitizePrefs(read());
  return prefs;
}

export function getPrefs() {
  return prefs;
}

export function setPref(key, value) {
  if (!Object.hasOwn(DEFAULT_PREFS, key)) return;
  prefs = sanitizePrefs({ ...prefs, [key]: value });
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private mode): preferences last for this session only */
  }
  listeners.forEach((fn) => fn(key, prefs[key]));
}

export function onPrefChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resolveTheme(theme = prefs.theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Reflect preferences onto <html> so CSS tokens react. */
export function applyPrefs(root = document.documentElement) {
  root.dataset.theme = resolveTheme();
  root.dataset.themePref = prefs.theme;
  root.dataset.motion = prefs.motion === 'off' ? 'reduced' : prefs.motion;
  root.style.setProperty('--accent', ACCENTS[prefs.accent]);
  root.style.setProperty('--accent-ink', ACCENT_INK[prefs.accent]);
  root.style.setProperty('--strong-mix', ACCENT_INK[prefs.accent] === '#ffffff' ? '#000' : '#fff');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = root.dataset.theme === 'light' ? '#f5f2ff' : '#0b0f23';
}
