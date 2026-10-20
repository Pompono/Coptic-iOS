import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const screenshots = path.resolve('docs/settings-screenshots');
await mkdir(screenshots, { recursive: true });
const root = path.resolve('out');
const server = process.env.SETTINGS_SMOKE_BASE_URL ? null : http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const content = await readFile(file);
    const extension = path.extname(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
    response.writeHead(200, { 'Content-Type': types[extension] ?? 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404); response.end('Not found'); }
});
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.SETTINGS_SMOKE_BASE_URL ?? `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  console.log('Starting Chromium Settings smoke…');
  browser = await chromium.launch({ headless: true, timeout: 15000 });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, title, screenshot] of [
    ['/settings/', 'Settings', 'settings-home.png'],
    ['/settings/account/?mode=settings', 'Account', 'settings-account.png'],
    ['/settings/preferences/', 'Preferences', 'settings-preferences.png'],
    ['/settings/progress/', 'Progress', 'settings-progress.png'],
    ['/settings/keyboard/', 'Keyboard', 'settings-keyboard.png'],
    ['/settings/recovery/', 'Recover progress', 'settings-recovery.png'],
  ]) {
    const response = await page.goto(base + route);
    console.log(`Loaded ${route}`);
    assert.equal(response.status(), 200, route);
    await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').count(), 1, `${route} has one page title`);
    if (route === '/settings/') {
      for (const category of ['Preferences', 'Progress', 'Keyboard']) await page.getByRole('link', { name: new RegExp(category, 'u') }).waitFor();
      assert.equal(await page.locator('.settings-navigation__row').count(), 3, 'Settings has three primary categories');
      assert.equal(await page.locator('.settings-navigation__row').filter({ hasText: 'Account' }).count(), 0, 'Account is only available from the profile entry');
      assert.equal(await page.getByText('Developer', { exact: true }).count(), 0);
    }
    if (route.startsWith('/settings/') && route !== '/settings/') {
      assert.equal(await page.locator('.mobile-chin-dock__item[aria-current="page"][aria-label="Settings"]').count(), 1, 'Settings stays selected in a submenu');
      await page.getByRole('link', { name: 'Settings', exact: true }).first().waitFor();
    }
    if (route === '/settings/progress/') {
      assert.match(await page.locator('body').innerText(), /Progress stays on this device|Synced|Syncing|Offline|Pending|Needs attention|Error/u);
      for (const removed of ['Enable Cloud Sync', 'Export Progress', 'Import Progress']) assert.equal(await page.getByText(removed, { exact: true }).count(), 0, removed);
    }
    if (route === '/settings/preferences/') {
      await page.getByLabel('Appearance').selectOption('dark');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.getByLabel('Appearance').selectOption('light');
      const fonts = page.getByLabel('Coptic font');
      assert.deepEqual(await fonts.locator('option').allTextContents(), ['Modern', 'Classic']);
      await fonts.selectOption('unicode');
      assert.equal(await page.evaluate(() => localStorage.getItem('coptic-font-mode')), 'unicode');
      await page.reload();
      assert.equal(await page.getByLabel('Coptic font').inputValue(), 'unicode', 'saved font selection remains selected');
    }
    if (route === '/settings/account/?mode=settings') {
      assert.equal(await page.getByRole('heading', { name: 'Account settings', exact: true }).count(), 0);
    }
    await page.screenshot({ path: path.join(screenshots, screenshot), fullPage: true });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.screenshot({ path: path.join(screenshots, screenshot.replace('.png', '-dark.png')), fullPage: true });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Settings home and five submenu routes at 390×844; account entry, font preference, recovery route, and removed backup/sync controls validated. Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
