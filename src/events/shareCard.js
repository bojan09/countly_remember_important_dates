// Share-card layout rules: sizes, themes, text fitting and file names. No DOM here, so the rules
// (and the text that ends up on the image) can be unit-tested. Drawing lives in components/shareStudio.js.

export const SHARE_FORMATS = [
  { id: 'story', width: 1080, height: 1920 },
  { id: 'square', width: 1080, height: 1080 },
  { id: 'wide', width: 1200, height: 630 },
];

export const SHARE_THEMES = {
  night: { bg: ['#0b0f23', '#231a63'], text: '#ffffff', sub: 'rgba(255,255,255,0.78)', chip: 'rgba(255,255,255,0.14)' },
  day: { bg: ['#f7f4ff', '#e2dbff'], text: '#1a0f3a', sub: 'rgba(26,15,58,0.76)', chip: 'rgba(26,15,58,0.08)' },
  vivid: { bg: ['#6a4bf0', '#b8307a'], text: '#ffffff', sub: 'rgba(255,255,255,0.88)', chip: 'rgba(255,255,255,0.2)' },
};

export const formatById = (id) => SHARE_FORMATS.find((f) => f.id === id) || SHARE_FORMATS[0];

/**
 * Break `text` into at most `maxLines` lines no wider than `maxWidth`, measured by `measure(str)`.
 * Words are never split unless a single word is too wide (then it is cut). The last line ends with
 * an ellipsis when text was dropped.
 */
export function wrapLines(measure, text, maxWidth, maxLines = 2) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let cur = '';
  const fits = (s) => measure(s) <= maxWidth;
  const cut = (word) => {
    let w = word;
    while (w.length > 1 && !fits(w)) w = [...w].slice(0, -1).join('');
    return w;
  };
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    const word = words[i];
    const next = cur ? `${cur} ${word}` : word;
    if (fits(next)) {
      cur = next;
      i++;
    } else if (cur) {
      lines.push(cur);
      cur = '';
    } else {
      lines.push(cut(word));
      i++;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (i < words.length) {
    // drop whole trailing words first; only cut characters when nothing else fits
    let last = lines[lines.length - 1] ?? '';
    let parts = last.split(' ');
    while (parts.length > 1 && !fits(`${parts.join(' ')}…`)) parts.pop();
    last = parts.join(' ');
    while (last && !fits(`${last}…`)) last = [...last].slice(0, -1).join('').trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** Safe image file name: "moms-birthday-story.png". */
export function shareFilename(title, formatId) {
  const base = String(title || 'countly').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'countly';
  return `${base}-${formatById(formatId).id}.png`;
}

/** Plain-text version for the share sheet / clipboard. */
export function shareText({ title, when, dateText, appName }) {
  return [title ? `${title} — ${when}` : when, dateText, appName].filter(Boolean).join('\n');
}

/** Cover-fit source rectangle: the part of a (sw x sh) image that fills a (dw x dh) box. */
export function coverRect(sw, sh, dw, dh) {
  const scale = Math.max(dw / sw, dh / sh);
  const w = dw / scale;
  const h = dh / scale;
  return { sx: (sw - w) / 2, sy: (sh - h) / 2, sw: w, sh: h };
}
