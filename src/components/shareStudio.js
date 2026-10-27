// Share image studio: renders an event as a PNG on a canvas (nothing is uploaded), previews it
// and hands it to the share sheet or downloads it. Layout rules are in events/shareCard.js.
import { h, openModal, toast } from './ui.js';
import { icon } from './icons.js';
import { sceneSvg } from '../scenes/art.js';
import { logoMark } from './logo.js';
import { daysLabel } from './eventCard.js';
import { eventTitle } from '../store/demo.js';
import { t, formatDate } from '../i18n/index.js';
import { SHARE_FORMATS, SHARE_THEMES, formatById, wrapLines, shareFilename, shareText, coverRect } from '../events/shareCard.js';

const FONT = () => getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

function svgImage(svg, width, height) {
  // Standalone SVG needs its own namespace and exactly one width/height; markup meant for inline HTML may lack or double them.
  const root = svg.match(/^<svg\b[^>]*>/)[0];
  let tag = root.replace(/\s(width|height)="[^"]*"/g, '');
  if (!/xmlns=/.test(tag)) tag = tag.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  tag = tag.replace('<svg', `<svg width="${width}" height="${height}"`);
  const url = URL.createObjectURL(new Blob([tag + svg.slice(root.length)], { type: 'image/svg+xml' }));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => resolve({ img: null, url });
    img.src = url;
  });
}

const rr = (g, x, y, w, hgt, r) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hgt, r);
  g.arcTo(x + w, y + hgt, x, y + hgt, r);
  g.arcTo(x, y + hgt, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

/** Text that will be drawn, derived once so the canvas label and the pixels never disagree. */
export function cardText(ev, today, opts) {
  return {
    title: opts.showTitle ? `${eventTitle(ev)}${ev.emoji ? ` ${ev.emoji}` : ''}` : '',
    big: daysLabel(ev, today),
    date: opts.showDate ? formatDate(ev.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + (ev.time ? ` · ${ev.time}` : '') : '',
    app: t('app.name'),
    tagline: t('app.tagline'),
  };
}

/** Draw the card onto `canvas` (sized to the format). Resolves when the art has loaded. */
export async function drawCard(canvas, ev, today, opts) {
  const fmt = formatById(opts.format);
  const theme = SHARE_THEMES[opts.theme] || SHARE_THEMES.night;
  const { width: W, height: H } = fmt;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const text = cardText(ev, today, opts);
  const font = FONT();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(1, theme.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  const u = Math.min(W, H) / 1080; // unit: scales type with the short edge
  const pad = Math.round(W >= H ? 64 * Math.max(u, 0.6) + 20 : 72);
  const landscape = W > H;
  const urls = [];
  g.textBaseline = 'alphabetic';

  // art block
  let art = null;
  if (opts.showArt) {
    const box = landscape ? { x: Math.round(W * 0.5), y: 0, w: Math.round(W * 0.5), h: H } : { x: 0, y: 0, w: W, h: Math.round(H * (opts.format === 'story' ? 0.4 : 0.36)) };
    const loaded = await svgImage(sceneSvg(ev.scene, { variant: 'hero', mood: opts.theme === 'day' ? 'day' : 'sunset', align: 'right', animate: false }), 1600, 1440);
    urls.push(loaded.url);
    if (loaded.img) {
      const r = coverRect(1600, 1440, box.w, box.h);
      g.save();
      g.beginPath();
      g.rect(box.x, box.y, box.w, box.h);
      g.clip();
      g.drawImage(loaded.img, r.sx, r.sy, r.sw, r.sh, box.x, box.y, box.w, box.h);
      g.restore();
      art = box;
    }
  }

  // text column: measure first (dry run) so the block can be shrunk to fit and centred between art and footer
  const colX = pad;
  const colW = landscape && art ? art.x - pad * 1.6 : W - pad * 2;
  const logoSize = Math.round(76 * Math.max(u, 0.7));
  const footerTop = H - pad - logoSize;
  const top = landscape ? pad : (art ? art.y + art.h : 0) + pad * 0.6;
  const base = Math.max(u, landscape ? 0.9 : 1);

  function layout(k, dry) {
    let y = 0;
    const out = [];
    const titleSize = Math.round((landscape ? 62 : 76) * base * k);
    if (text.title) {
      g.font = `800 ${titleSize}px ${font}`;
      for (const line of wrapLines((x) => g.measureText(x).width, text.title, colW, 2)) {
        y += titleSize * 1.12;
        out.push({ font: `800 ${titleSize}px ${font}`, fill: theme.text, text: line, y });
      }
      y += titleSize * 0.25;
    }
    let bigSize = Math.round((landscape ? 130 : 190) * base * k);
    g.font = `800 ${bigSize}px ${font}`;
    while (g.measureText(text.big).width > colW && bigSize > 40) {
      bigSize -= 6;
      g.font = `800 ${bigSize}px ${font}`;
    }
    y += bigSize * 1.0;
    out.push({ font: `800 ${bigSize}px ${font}`, fill: opts.theme === 'day' ? '#4a3bb0' : theme.text, text: text.big, y });
    if (text.date) {
      const dateSize = Math.round((landscape ? 34 : 44) * base * k);
      g.font = `600 ${dateSize}px ${font}`;
      y += dateSize * 0.5;
      for (const line of wrapLines((x) => g.measureText(x).width, text.date, colW, 2)) {
        y += dateSize * 1.3;
        out.push({ font: `600 ${dateSize}px ${font}`, fill: theme.sub, text: line, y });
      }
    }
    return { height: y + (dry ? 0 : 0), out };
  }
  let k = 1;
  let block = layout(k, true);
  const room = footerTop - top - pad * 0.4;
  while (block.height > room && k > 0.45) {
    k -= 0.05;
    block = layout(k, true);
  }
  const startY = landscape ? top : top + Math.max(0, Math.min((room - block.height) / 2, H * 0.12));
  for (const item of block.out) {
    g.font = item.font;
    g.fillStyle = item.fill;
    g.fillText(item.text, colX, startY + item.y);
  }

  // footer: logo + app name + tagline
  const fy = H - pad;
  const logo = await svgImage(logoMark(logoSize), logoSize, logoSize);
  urls.push(logo.url);
  if (logo.img) g.drawImage(logo.img, colX, fy - logoSize, logoSize, logoSize);
  g.fillStyle = theme.text;
  g.font = `800 ${Math.round(36 * Math.max(u, 0.8))}px ${font}`;
  g.fillText(text.app, colX + logoSize + 20, fy - logoSize * 0.5 + 2);
  g.fillStyle = theme.sub;
  g.font = `500 ${Math.round(26 * Math.max(u, 0.8))}px ${font}`;
  g.fillText(text.tagline, colX + logoSize + 20, fy - logoSize * 0.5 + 38 * Math.max(u, 0.8));

  urls.forEach((u2) => URL.revokeObjectURL(u2));
  return { ...text, textBottom: Math.round(startY + block.height), footerTop };
}

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export function openShareStudio(ev, ctx) {
  const opts = { format: 'story', theme: 'night', showTitle: true, showDate: true, showArt: true };
  const canvas = h('canvas', { class: 'ss-canvas', role: 'img' });
  const status = h('p', { class: 'muted small', role: 'status' });
  let drawing = Promise.resolve();
  let token = 0;

  async function redraw() {
    const mine = ++token;
    drawing = drawing.then(async () => {
      if (mine !== token) return;
      const text = await drawCard(canvas, ev, ctx.today, opts);
      canvas.setAttribute('aria-label', t('share.canvasLabel', { text: [text.title, text.big, text.date].filter(Boolean).join(', ') }));
      canvas.dataset.textBottom = String(text.textBottom);
      canvas.dataset.footerTop = String(text.footerTop);
      canvas.dataset.ready = '1';
    });
    canvas.dataset.ready = '';
    return drawing;
  }

  const radio = (name, label, values, key) => {
    const row = h('div', { class: 'ss-opts', role: 'radiogroup', 'aria-label': label });
    for (const v of values) {
      const b = h('button', { type: 'button', class: 'ss-opt', role: 'radio', 'data-value': v.id, 'aria-checked': String(opts[key] === v.id) }, v.label);
      b.addEventListener('click', () => {
        opts[key] = v.id;
        row.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        canvas.classList.toggle('is-landscape', formatById(opts.format).width > formatById(opts.format).height);
        canvas.classList.toggle('is-square', opts.format === 'square');
        redraw();
      });
      row.append(b);
    }
    return h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), row);
  };
  const check = (id, label, key) => {
    const input = h('input', { type: 'checkbox', id, checked: opts[key] });
    input.addEventListener('change', () => {
      opts[key] = input.checked;
      redraw();
    });
    return h('label', { class: 'rm-opt', for: id }, input, h('span', null, label));
  };

  const fileFor = async () => {
    await drawing;
    const blob = await toBlob(canvas);
    return blob ? new File([blob], shareFilename(eventTitle(ev), opts.format), { type: 'image/png' }) : null;
  };
  const text = () => {
    const c = cardText(ev, ctx.today, { ...opts, showTitle: true, showDate: true });
    return shareText({ title: c.title, when: c.big, dateText: c.date, appName: `${c.app} — ${c.tagline}` });
  };

  async function download() {
    const file = await fileFor();
    if (!file) return toast(t('share.failed'));
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: file.name, hidden: true });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = t('share.saved', { name: file.name });
  }
  async function share() {
    const file = await fileFor();
    if (!file) return toast(t('share.failed'));
    try {
      await navigator.share({ files: [file], title: eventTitle(ev), text: text() });
    } catch (err) {
      if (err && err.name !== 'AbortError') toast(t('share.failed'));
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      toast(t('share.copied'));
    } catch {
      toast(t('share.failed'));
    }
  }

  const canShareFiles = typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  const controls = h(
    'div',
    { class: 'ss-controls' },
    radio('format', t('share.format'), SHARE_FORMATS.map((f) => ({ id: f.id, label: t(`share.formats.${f.id}`) })), 'format'),
    radio('theme', t('share.theme'), Object.keys(SHARE_THEMES).map((id) => ({ id, label: t(`share.themes.${id}`) })), 'theme'),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, t('share.show')), h('div', { class: 'rm-opts' }, check('ss-title', t('share.showTitle'), 'showTitle'), check('ss-date', t('share.showDate'), 'showDate'), check('ss-art', t('share.showArt'), 'showArt'))),
    status,
  );

  const actions = [{ label: t('share.copyText'), variant: 'secondary', onClick: () => copy() }, { label: t('share.download'), variant: canShareFiles ? 'secondary' : 'primary', onClick: () => download() }];
  if (canShareFiles) actions.push({ label: t('actions.share'), onClick: () => share() });
  openModal({ title: t('share.title'), variant: 'studio', content: h('div', { class: 'ss' }, h('div', { class: 'ss-preview' }, canvas), controls), actions });
  redraw();
}
