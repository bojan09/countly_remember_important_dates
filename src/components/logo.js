import { logoMark as mark } from './icons.js';

let n = 0;

/** Logo markup with gradient ids unique to this instance (hidden instances must not own shared defs). */
export function logoMark(size = 40) {
  const id = `lm${++n}`;
  return mark(size)
    .replaceAll('lm-g', `${id}g`)
    .replaceAll('lm-p', `${id}p`)
    .replaceAll('lm-h', `${id}h`);
}
