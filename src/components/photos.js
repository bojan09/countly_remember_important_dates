// Photo helpers: on-device downscaling before storage and an accessible full-size viewer.
// Photos never leave the device; they are stored as Blobs in IndexedDB (see store/events.js).
import { h, openModal, confirmDialog, toast } from './ui.js';
import { icon } from './icons.js';
import { t } from '../i18n/index.js';

export const PHOTO_MAX_EDGE = 1600;
const KEEP_BELOW = 600 * 1024; // small enough already: store the original untouched

/** Size that fits `w`x`h` inside a `max` square, never enlarging. */
export function fitWithin(w, h, max = PHOTO_MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
}

/**
 * Downscale large photos to JPEG (max 1600px, quality 0.85) so storage stays small. Falls back to
 * the original file whenever decoding or encoding is unavailable or would not make it smaller.
 */
export async function prepareImage(file) {
  const canDecode = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) && typeof createImageBitmap === 'function';
  if (!canDecode) return file;
  let bmp;
  try {
    bmp = await createImageBitmap(file); // applies EXIF orientation
  } catch {
    return file;
  }
  try {
    const { width, height, scale } = fitWithin(bmp.width, bmp.height);
    if (scale === 1 && file.size <= KEEP_BELOW) return file;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; // JPEG has no alpha
    g.fillRect(0, 0, width, height);
    g.drawImage(bmp, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    return new File([blob], `${String(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } finally {
    if (bmp.close) bmp.close();
  }
}

/**
 * Full-size viewer with previous/next (arrow keys), delete and close.
 * `photos`: [{id, name}], `getBlob(id)`, `onDelete(id)` -> Promise (rejects on failure).
 */
export function openPhotoViewer({ photos, start = 0, getBlob, onDelete }) {
  let list = [...photos];
  let index = Math.min(Math.max(start, 0), list.length - 1);
  let url = null;
  const img = h('img', { class: 'pv-img', alt: '' });
  const caption = h('figcaption', { class: 'pv-cap', 'aria-live': 'polite' });
  const prev = h('button', { type: 'button', class: 'icon-btn pv-nav prev', 'aria-label': t('photos.previous'), html: icon('chevronLeft', { size: 22 }) });
  const next = h('button', { type: 'button', class: 'icon-btn pv-nav next', 'aria-label': t('photos.next'), html: icon('chevronRight', { size: 22 }) });
  const stage = h('div', { class: 'pv-stage' }, prev, img, next);
  const figure = h('figure', { class: 'pv' }, stage, caption);

  async function show() {
    const item = list[index];
    if (url) URL.revokeObjectURL(url);
    url = null;
    const blob = await getBlob(item.id).catch(() => null);
    if (!blob) {
      img.removeAttribute('src');
      img.alt = t('photos.unavailable');
    } else {
      url = URL.createObjectURL(blob);
      img.src = url;
      img.alt = item.name;
    }
    caption.textContent = t('photos.position', { n: index + 1, total: list.length, name: item.name });
    prev.disabled = index === 0;
    next.disabled = index === list.length - 1;
  }
  const go = (d) => {
    const i = index + d;
    if (i >= 0 && i < list.length) {
      index = i;
      show();
    }
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  const ui = openModal({
    title: t('photos.viewerTitle'),
    variant: 'lightbox',
    content: figure,
    onClose: () => url && URL.revokeObjectURL(url),
    actions: onDelete
      ? [
          {
            label: t('actions.removePhoto'),
            variant: 'danger',
            onClick: async () => {
              const item = list[index];
              if (!(await confirmDialog({ title: t('photos.deleteTitle'), body: t('photos.deleteBody', { name: item.name }), confirmLabel: t('actions.delete'), danger: true }))) return;
              try {
                await onDelete(item.id);
              } catch {
                toast(t('toast.saveFailed'));
                return;
              }
              list = list.filter((p) => p.id !== item.id);
              if (!list.length) return ui.close();
              index = Math.min(index, list.length - 1);
              show();
            },
          },
          { label: t('nav.close'), variant: 'secondary' },
        ]
      : [{ label: t('nav.close'), variant: 'secondary' }],
  });
  ui.dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });
  show();
  return ui;
}
