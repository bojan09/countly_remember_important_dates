import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

const SKIP = new Set(['node_modules', '.git', '.tmp', '.omc', '.claude', 'screenshots']);

export function walk(dir, filter = () => true, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

export const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');
export const read = (p) => readFileSync(p, 'utf8');

export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !('one' in v && 'other' in v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
