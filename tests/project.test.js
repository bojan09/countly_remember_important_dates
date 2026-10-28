import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { walk, read, rel, ROOT } from './helpers.mjs';

const manifest = JSON.parse(read(ROOT + 'manifest.webmanifest'));
const swSource = read(ROOT + 'sw.js');

function pngSize(path) {
  const buf = readFileSync(path);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${path} is a PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('manifest is installable: name, start_url, standalone and 192/512 + maskable icons that exist', () => {
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.short_name);
  assert.ok(manifest.start_url && manifest.scope);
  const sizes = {};
  for (const icon of manifest.icons) {
    const file = ROOT + icon.src;
    assert.ok(existsSync(file), `icon missing: ${icon.src}`);
    if (icon.type === 'image/png') {
      const { w, h } = pngSize(file);
      assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} declared ${icon.sizes}`);
      sizes[`${icon.purpose}:${icon.sizes}`] = true;
    }
  }
  assert.ok(sizes['any:192x192'] && sizes['any:512x512'] && sizes['maskable:512x512']);
});

test('service worker precache list matches the files on disk', () => {
  const listed = [...swSource.matchAll(/^\s*'(\.\/[^']*)'/gm)].map((m) => m[1]);
  const files = [
    ...walk(ROOT + 'src', () => true),
    ...walk(ROOT + 'assets', () => true),
    ROOT + 'index.html',
    ROOT + 'manifest.webmanifest',
  ].map((f) => './' + rel(f));
  const expected = new Set(files);
  const missingFromList = [...expected].filter((f) => !listed.includes(f));
  const stale = listed.filter((f) => f !== './' && !expected.has(f));
  assert.deepEqual(missingFromList, [], 'files not precached');
  assert.deepEqual(stale, [], 'precached files that do not exist');
  assert.ok(listed.includes('./'));
  assert.match(swSource, /const VERSION = 'countly-shell-v\d+'/);
});

test('index.html wires manifest, CSP, theme boot script and all stylesheets', () => {
  const html = read(ROOT + 'index.html');
  assert.match(html, /rel="manifest"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /<meta name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /src\/boot\.js/);
  for (const m of html.matchAll(/href="(\.\/src\/styles\/[^"]+)"/g)) assert.ok(existsSync(ROOT + m[1].slice(2)), m[1]);
});

test('no remote runtime dependencies: only same-origin URLs in shipped code', () => {
  const files = [...walk(ROOT + 'src', (f) => /\.(js|css)$/.test(f)), ROOT + 'index.html', ROOT + 'sw.js', ROOT + 'manifest.webmanifest'];
  const offenders = [];
  for (const f of files) {
    for (const m of read(f).matchAll(/https?:\/\/[^\s'"`)]+/g)) {
      if (m[0].startsWith('http://www.w3.org/')) continue; // SVG namespace identifier, never fetched
      offenders.push(`${rel(f)}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('no framework or TypeScript in the runtime (vanilla HTML/CSS/JS only)', () => {
  assert.equal(walk(ROOT + 'src', (f) => /\.(ts|tsx|jsx|vue|svelte)$/.test(f)).length, 0);
  const pkg = JSON.parse(read(ROOT + 'package.json'));
  assert.equal(pkg.dependencies, undefined, 'no runtime dependencies');
});

test('innerHTML is only used for trusted static markup (no user data paths)', () => {
  const uses = [];
  for (const f of walk(ROOT + 'src', (p) => p.endsWith('.js'))) {
    read(f).split('\n').forEach((line, i) => {
      if (/\.innerHTML\s*=/.test(line)) uses.push(`${rel(f)}:${i + 1}`);
    });
  }
  // Only the DOM toolkit may assign innerHTML (h() "html" attr + iconEl), always with icon/scene markup.
  assert.ok(uses.every((u) => u.startsWith('src/components/ui.js')), `unexpected innerHTML: ${uses.join(', ')}`);
});

test('user-facing text is never passed through html: attributes', () => {
  const bad = [];
  for (const f of walk(ROOT + 'src', (p) => p.endsWith('.js'))) {
    read(f).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/html:\s*([^,}\n]+)/g)) {
        const v = m[1].trim();
        if (!/^(icon\(|sceneSvg\(|logoMark\(|flagSvg\(|art\b|svg\b|logo)/.test(v)) bad.push(`${rel(f)}:${i + 1}: ${v}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});

test('all JavaScript parses (syntax check)', async () => {
  const { spawnSync } = await import('node:child_process');
  const files = [...walk(ROOT + 'src', (p) => p.endsWith('.js')), ROOT + 'sw.js', ...walk(ROOT + 'tools', (p) => p.endsWith('.mjs'))];
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${rel(f)}: ${r.stderr}`);
  }
});

test('scenes render valid, self-contained SVG with unique gradient ids', async () => {
  const { sceneSvg, SCENE_KINDS } = await import('../src/scenes/art.js');
  for (const kind of SCENE_KINDS) {
    for (const variant of ['card', 'hero', 'wide']) {
      const svg = sceneSvg(kind, { variant, mood: 'day' });
      assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
      assert.ok(!/<script|onload|href=|xlink/i.test(svg), `${kind}/${variant} contains unsafe markup`);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `${kind} duplicate ids`);
      for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref[1]), `${kind}/${variant}: dangling ${ref[1]}`);
    }
  }
  const a = sceneSvg('beach'), b = sceneSvg('beach');
  const idsA = new Set([...a.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  assert.ok([...b.matchAll(/ id="([^"]+)"/g)].every((m) => !idsA.has(m[1])), 'ids are unique across instances');
});

test('the version shown in About matches package.json', async () => {
  const { VERSION } = await import('../src/version.js');
  assert.equal(VERSION, JSON.parse(read(ROOT + 'package.json')).version);
});
