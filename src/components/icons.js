// Inline stroke icons (24x24). Paths are authored for Countly; static trusted markup.
const P = {
  home: '<path d="M3.5 11 12 3.8 20.5 11"/><path d="M5.5 9.7V20h4.6v-5.6h3.8V20h4.6V9.7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="8.5" cy="14.5" r=".9" fill="currentColor"/><circle cx="12" cy="14.5" r=".9" fill="currentColor"/>',
  timeline: '<path d="M4 6.5h2M4 12h2M4 17.5h2"/><rect x="9" y="4.5" width="11" height="4" rx="1.6"/><rect x="9" y="10" width="11" height="4" rx="1.6"/><rect x="9" y="15.5" width="11" height="4" rx="1.6"/>',
  stats: '<path d="M3.5 20.5h17"/><path d="M4.5 16 9 11l3.5 3L19.5 6.5"/><path d="M15.5 6.5h4v4"/>',
  categories: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/><path d="M4 12h5M13 12h7"/>',
  memories: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M4 17.5 9.5 13l3.5 3 2.5-2 5 4"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/><circle cx="12" cy="12" r="6.6"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 20.8a2.2 2.2 0 0 0 4 0"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 5 5"/>',
  plus: '<path d="M12 4.5v15M4.5 12h15"/>',
  chevronLeft: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  chevronDown: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
  chevronUp: '<path d="m5.5 14.5 6.5-6.5 6.5 6.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9M6.5 7.2C4 8.9 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  chevronRight: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  chevronDown: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
  arrowRight: '<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"/>',
  arrowLeft: '<path d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5"/>',
  x: '<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>',
  star: '<path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor"/>',
  tag: '<path d="M3.8 12.4V4.8h7.6l9 9a1.6 1.6 0 0 1 0 2.2l-5.4 5.4a1.6 1.6 0 0 1-2.2 0z"/><circle cx="8" cy="9" r="1.3" fill="currentColor"/>',
  share: '<circle cx="6.5" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.6 10.8 6.8-3.6M8.6 13.2l6.8 3.6"/>',
  pencil: '<path d="m4.5 19.5.9-4.2 10.7-10.7a1.9 1.9 0 0 1 2.7 0l.6.6a1.9 1.9 0 0 1 0 2.7L8.7 18.6z"/><path d="m14.2 6.6 3.2 3.2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/>',
  more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
  dots: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
  moon: '<path d="M19.8 14.6A8.2 8.2 0 0 1 9.4 4.2a8.2 8.2 0 1 0 10.4 10.4z"/>',
  auto: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8v16.4" /><path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor"/>',
  download: '<path d="M12 4v11M7.5 10.8 12 15.3l4.5-4.5M4.5 19.5h15"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 19.5h15"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.6 2.4 3.8 5.3 3.8 8.6s-1.2 6.2-3.8 8.6c-2.6-2.4-3.8-5.3-3.8-8.6S9.4 5.8 12 3.4z"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".9" fill="currentColor"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v9a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V9M10 13h4"/>',
  mapPin: '<path d="M12 20.5s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="10.5" r="2.2"/>',
  repeat: '<path d="M17 4.5l3 3-3 3M4 11V9.5a2 2 0 0 1 2-2h14M7 19.5l-3-3 3-3M20 13v1.5a2 2 0 0 1-2 2H4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
  heart: '<path d="M12 20.2S4 15.4 4 9.6A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 8 2.2c0 5.8-8 10.6-8 10.6z"/>',
  cake: '<path d="M4.5 20.5h15v-6.8a2 2 0 0 0-2-2h-11a2 2 0 0 0-2 2z"/><path d="M4.5 16c1.9 1.7 3.4 1.7 5 0s3.1-1.7 5 0 3.4 1.7 5 0"/><path d="M12 11.7V8.2M12 6.8c-1-1-.9-2 0-3 .9 1 1 2 0 3z"/>',
  plane: '<path d="M21 4.2 11.6 13.6M21 4.2l-6.2 16-3.2-6.6L5 10.4z"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.6"/><path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5M3.5 13h17"/>',
  user: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.8 20c.6-3.8 3.4-5.8 7.2-5.8s6.6 2 7.2 5.8"/>',
  wifiOff: '<path d="M3 3l18 18M5 9.6a11 11 0 0 1 4-2.3M19 9.6a11 11 0 0 0-5.5-2.7M8.5 13.4a6.3 6.3 0 0 1 2.2-1.2M15.5 13.4a6.3 6.3 0 0 0-1-.9"/><circle cx="12" cy="17.6" r=".9" fill="currentColor"/>',
  shield: '<path d="M12 3.4 5 6v5.6c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6z"/><path d="m9 12 2.2 2.2L15.4 10"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="m4 17.5 5.5-4.5 3.5 3 2.5-2 5 4"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18.1l-1.8-5.5L4.7 10.8 10.2 9z" fill="currentColor"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};

export function icon(name, { size = 22, cls = '', label = '' } = {}) {
  const body = P[name] || P.info;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y} focusable="false">${body}</svg>`;
}

export const ICON_NAMES = Object.keys(P);

/** Countly mark: calendar with binder rings and a heart. */
export function logoMark(size = 40) {
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <defs><linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c7b8ff"/><stop offset="1" stop-color="#7c5cff"/></linearGradient>
  <linearGradient id="lm-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ece6ff"/></linearGradient>
  <linearGradient id="lm-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7aa8"/><stop offset="1" stop-color="#f0407e"/></linearGradient></defs>
  <rect x="7" y="9" width="50" height="48" rx="13" fill="url(#lm-g)"/><rect x="7" y="19" width="50" height="38" rx="13" fill="url(#lm-p)"/><rect x="7" y="19" width="50" height="10" fill="url(#lm-p)"/>
  <rect x="19" y="4" width="6.5" height="14" rx="3.25" fill="#fff"/><rect x="38.5" y="4" width="6.5" height="14" rx="3.25" fill="#fff"/>
  <path d="M32 50.5S20 43.4 20 34.8a6.6 6.6 0 0 1 12-3.7 6.6 6.6 0 0 1 12 3.7c0 8.6-12 15.7-12 15.7z" fill="url(#lm-h)"/></svg>`;
}

export function flagSvg(lang) {
  if (lang === 'mk') {
    return `<svg class="flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true" focusable="false"><rect width="28" height="20" rx="3" fill="#d6212b"/><g fill="#f9d12e"><path d="M14 10 0 0v2.4zM14 10 0 20v-2.4zM14 10 28 0v2.4zM14 10l14 10v-2.4zM14 10 8 0h3.6zM14 10l6-10h-3.6zM14 10 8 20h3.6zM14 10l6 10h-3.6zM14 10 0 7.2v5.6zM14 10l14-2.8v5.6z"/><circle cx="14" cy="10" r="3.6" stroke="#d6212b" stroke-width=".9"/></g></svg>`;
  }
  return `<svg class="flag" viewBox="0 0 28 20" width="22" height="16" aria-hidden="true" focusable="false"><rect width="28" height="20" rx="3" fill="#fff"/><g fill="#d63a47">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect y="${i * 2.86}" width="28" height="1.43"/>`).join('')}</g><rect width="12" height="10.7" rx="1.5" fill="#3b4a9e"/></svg>`;
}
