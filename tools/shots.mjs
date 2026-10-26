// Capture design-fidelity screenshots: node tools/shots.mjs [outDir] [viewportKey ...]
import { mkdirSync } from 'node:fs';
import { launch, openPage, VIEWPORTS } from './browser.mjs';

const out = process.argv[2] || 'docs/screenshots';
const only = process.argv.slice(3);
const lang = process.env.SHOT_LANG || 'en';
const suffix = lang === 'en' ? '' : `-${lang}`;
mkdirSync(out, { recursive: true });

const ROUTES = {
  home: '#/',
  calendar: '#/calendar',
  timeline: '#/timeline',
  stats: '#/stats',
  categories: '#/categories',
  memories: '#/memories',
  settings: '#/settings',
  detail: '#/event/sample-birthday',
  'detail-vacation': '#/event/sample-vacation',
};

const ctx = await launch();
if (!ctx) {
  console.error('No Chromium-family browser found. Set CHROME_PATH.');
  process.exit(1);
}
try {
  for (const [vk, vp] of Object.entries(VIEWPORTS)) {
    if (only.length && !only.includes(vk)) continue;
    for (const theme of ['dark', 'light']) {
      for (const [name, route] of Object.entries(ROUTES)) {
        const page = await openPage(ctx, { viewport: vp, route, prefs: { theme, lang }, colorScheme: theme });
        await page.screenshot({ path: `${out}/${vk}-${theme}-${name}${suffix}.png`, fullPage: false });
        if (page.errors.length) console.warn(`[${vk} ${theme} ${name}] errors:`, page.errors);
        await page.close();
      }
    }
  }
  console.log('screenshots written to', out);
} finally {
  await ctx.close();
}
