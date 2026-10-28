// Progressive list rendering: show the first `size` rows and a "Show more" button for the rest.
// Long lists (hundreds of events, each with scene art) cost seconds to build on a phone, and
// nobody reads them all at once. Keyboard users get focus moved to the first new row.
import { h } from './ui.js';
import { t, formatNumber } from '../i18n/index.js';

export const CHUNK = 30;

/**
 * Fill `list` (a ul/ol/div) with `items.map(render)` in chunks; `footer` receives the button.
 * Returns { more, shown } so callers/tests can inspect progress.
 */
export function chunked({ list, footer, items, render, place = null, size = CHUNK }) {
  let shown = 0;
  const btn = h('button', { type: 'button', class: 'btn secondary more-btn' });
  btn.addEventListener('click', () => more(true));

  function paintFooter() {
    const left = items.length - shown;
    if (left > 0) {
      btn.textContent = t('list.showMore', { left: formatNumber(left) });
      footer.replaceChildren(btn);
    } else {
      footer.replaceChildren();
    }
  }

  function more(focusFirst = false) {
    const next = items.slice(shown, shown + size).map(render);
    shown += next.length;
    if (place) next.forEach((node, i) => place(node, items[shown - next.length + i]));
    else list.append(...next);
    paintFooter();
    if (focusFirst && next[0]) {
      const target = next[0].matches?.('a,button') ? next[0] : next[0].querySelector?.('a,button');
      if (target) target.focus({ preventScroll: false });
    }
  }

  list.replaceChildren();
  more(false);
  return { more, get shown() { return shown; } };
}
