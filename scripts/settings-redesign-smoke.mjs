import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = path.resolve('out');
const screenshots = path.resolve('docs/settings-screenshots');
await mkdir(screenshots, { recursive: true });
const server = http.createServer(async (request, response) => {
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
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
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
    ['/settings/learning/', 'Learning & Language', 'settings-learning.png'],
    ['/settings/progress/', 'Progress', 'settings-progress.png'],
    ['/settings/keyboard/', 'Keyboard', 'settings-keyboard.png'],
  ]) {
    const response = await page.goto(base + route);
    console.log(`Loaded ${route}`);
    assert.equal(response.status(), 200, route);
    await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
    await page.waitForLoadState('networkidle');
    if (route === '/settings/') {
      for (const category of ['Account', 'Learning & Language', 'Progress', 'Keyboard']) await page.getByRole('link', { name: new RegExp(category, 'u') }).waitFor();
      assert.equal(await page.getByText('Developer', { exact: true }).count(), 0);
    }
    if (route.startsWith('/settings/') && route !== '/settings/') {
      assert.equal(await page.locator('.mobile-chin-dock__item[aria-current="page"][aria-label="Settings"]').count(), 1, 'Settings stays selected in a submenu');
      await page.getByRole('link', { name: 'Settings', exact: true }).first().waitFor();
    }
    if (route === '/settings/progress/') {
      assert.match(await page.locator('body').innerText(), /Learning remains on this device|Progress syncs automatically/u);
      for (const removed of ['Enable Cloud Sync', 'Export Progress', 'Import Progress']) assert.equal(await page.getByText(removed, { exact: true }).count(), 0, removed);
    }
    if (route === '/settings/learning/') {
      await page.getByLabel('Appearance').selectOption('dark');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.getByLabel('Appearance').selectOption('light');
    }
    await page.screenshot({ path: path.join(screenshots, screenshot), fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Settings home and four submenu routes at 390×844; removed backup/sync controls absent; tab selection and back paths work. Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
