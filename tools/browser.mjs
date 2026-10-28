// Shared helper: static server + headless Chromium-family browser (Edge/Chrome) via puppeteer-core.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createStaticServer } from './serve.mjs';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findBrowser() {
  return CANDIDATES.find((p) => existsSync(p)) || null;
}

export const VIEWPORTS = {
  'mobile-360': { width: 360, height: 640, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'mobile-390': { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'tablet-768': { width: 768, height: 1024, isMobile: false, hasTouch: true, deviceScaleFactor: 1 },
  'desktop-1280': { width: 1280, height: 800, deviceScaleFactor: 1 },
  'desktop-1440': { width: 1440, height: 900, deviceScaleFactor: 1 },
};

export async function launch() {
  const executablePath = findBrowser();
  if (!executablePath) return null;
  const server = createStaticServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });
  return {
    base,
    browser,
    /** Fresh, isolated profile per page (own localStorage, caches and service workers). */
    async newPage() {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const close = page.close.bind(page);
      page.close = async () => {
        await close().catch(() => {});
        await context.close().catch(() => {});
      };
      return page;
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}

/** New page with preset prefs; collects console errors/page errors into page.errors. */
export async function openPage(ctx, { viewport = VIEWPORTS['desktop-1440'], prefs = {}, route = '#/', colorScheme = 'dark', bypassCsp = false } = {}) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') page.errors.push(m.text());
  });
  await page.setViewport(viewport);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: colorScheme }]);
  const merged = { onboarded: true, ...prefs };
  await page.evaluateOnNewDocument((p) => {
    try {
      if (!localStorage.getItem('countly.prefs.v1')) localStorage.setItem('countly.prefs.v1', JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, merged);
  if (bypassCsp) await page.setBypassCSP(true); // lets tests inject axe-core; the shipped CSP is checked in project.test.js
  await page.goto(`${ctx.base}/${route}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.view', { timeout: 8000 });
  return page;
}
