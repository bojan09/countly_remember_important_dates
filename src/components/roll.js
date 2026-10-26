// Motion helpers: rolling numerals, count-up and one-shot celebration bursts.
// All of them respect the in-app motion level (full / calm / off) and the system
// reduced-motion setting; with motion off the final text is set immediately.

/** True only for the "full" level and when the system has not asked for reduced motion. */
export function motionFull() {
  if (document.documentElement.dataset.motion !== 'full') return false;
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Set `text` on a node as one span per character; characters that changed since the last call
 * roll in (so a ticking seconds digit flips instead of snapping). The first call never animates.
 */
export function setRolling(node, text) {
  if (node._text === text) return;
  const prev = node._text;
  node._text = text;
  const chars = [...text];
  const spans = node._spans;
  if (!spans || spans.length !== chars.length || prev === undefined) {
    node.textContent = '';
    node._spans = chars.map((ch) => {
      const s = document.createElement('span');
      s.className = 'roll-ch';
      s.textContent = ch;
      node.append(s);
      return s;
    });
    return;
  }
  const animate = motionFull();
  const before = [...prev];
  chars.forEach((ch, i) => {
    if (before[i] === ch) return;
    const s = spans[i];
    s.textContent = ch;
    if (animate) {
      s.classList.remove('roll');
      void s.offsetWidth; // restart the CSS animation
      s.classList.add('roll');
    }
  });
}

const counted = new Set();

/**
 * Animate an integer from 0 to `to` once per `key` per session. `format(n)` returns the display
 * text, so units and plural forms stay correct at every step.
 */
export function countUp(el, to, format, key) {
  if (!motionFull() || counted.has(key) || !(to > 0) || to > 100000) {
    el.textContent = format(to);
    return;
  }
  counted.add(key);
  const dur = Math.min(900, 380 + to * 6);
  const start = performance.now();
  el.textContent = format(0);
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    el.textContent = format(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1 && el.isConnected) requestAnimationFrame(step);
    else el.textContent = format(to);
  };
  requestAnimationFrame(step);
}

const burstShown = new Set();

/** One-shot confetti layer (pure CSS). Returns null when motion is off or it already played. */
export function celebrationBurst(key, h) {
  if (!motionFull() || burstShown.has(key)) return null;
  burstShown.add(key);
  const colors = ['#ff6fa9', '#ffd166', '#7c5cff', '#4dd4c6', '#ff9f43'];
  const layer = h('div', { class: 'burst', 'aria-hidden': 'true' });
  for (let i = 0; i < 28; i++) {
    layer.append(h('i', { style: { '--x': `${(i * 37) % 100}%`, '--c': colors[i % 5], '--d': `${(i % 9) * 0.12}s`, '--r': `${(i * 53) % 360}deg` } }));
  }
  return layer;
}
