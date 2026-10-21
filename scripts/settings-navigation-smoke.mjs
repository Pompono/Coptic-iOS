import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const output = path.resolve(process.env.SETTINGS_NAV_ARTIFACTS || '.codex-temp/settings-navigation');
await mkdir(output, { recursive: true });
const root = path.resolve('out');
const server = process.env.SETTINGS_SMOKE_BASE_URL ? null : http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.SETTINGS_SMOKE_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browserType = process.env.SETTINGS_BROWSER === 'webkit' ? webkit : chromium;
const browser = await browserType.launch({ headless: true, executablePath: process.env.COPTIC_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, recordVideo: { dir: output, size: { width: 390, height: 844 } } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const clean = value => value.replace(/\/$/, '');
const idle = async (route, title) => {
  await page.waitForURL(url => clean(url.pathname) === clean(route));
  await page.locator('.settings-navigation-host[data-settings-phase="idle"]').waitFor();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(await page.locator('[data-settings-layer]').count(), 1);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('[data-settings-layer][inert]').count(), 0);
  assert.equal(await page.locator('[data-settings-snapshot]').count(), 0);
};
const back = () => page.locator('.page-back').click();
const open = async route => {
  await page.goto(base + route);
  await page.waitForLoadState('networkidle');
};
try {
  await open('/settings/');
  await idle('/settings', 'Settings');
  await page.evaluate(() => {
    window.__host = document.querySelector('.settings-navigation-host');
    window.__dock = document.querySelector('.mobile-chin-dock');
    window.__frames = [];
    const sample = () => {
      const layers = [...document.querySelectorAll('[data-settings-layer]')];
      window.__frames.push(layers.map(node => ({ path: node.dataset.settingsLayer, x: node.getBoundingClientRect().x, inert: node.inert })));
      window.__sampling = requestAnimationFrame(sample);
    };
    sample();
  });
  await page.getByRole('link', { name: /Preferences/ }).click();
  await idle('/settings/preferences', 'Preferences');
  const frames = await page.evaluate(() => { cancelAnimationFrame(window.__sampling); return window.__frames; });
  const mid = frames.filter(frame => frame.length === 2 && frame[1].x > 1 && frame[1].x < 389);
  assert.ok(mid.length > 1, 'Push actually renders intermediate transformed positions');
  assert.ok(mid.every(frame => frame[0].x < 0 && frame.every(layer => layer.inert)), 'Outgoing parallax and inert layers');
  assert.ok(await page.evaluate(() => window.__host === document.querySelector('.settings-navigation-host') && window.__dock === document.querySelector('.mobile-chin-dock')), 'Host and dock DOM identities persist');
  await page.screenshot({ path: path.join(output, 'preferences-settled.png') });
  await back(); await idle('/settings', 'Settings');
  await page.goForward(); await idle('/settings/preferences', 'Preferences');
  await page.goBack(); await idle('/settings', 'Settings');
  const length = await page.evaluate(() => history.length);
  await page.evaluate(() => { const links = document.querySelectorAll('.settings-navigation__row'); links[0].click(); links[1].click(); links[0].click(); });
  await idle('/settings/preferences', 'Preferences');
  assert.equal(await page.evaluate(() => history.length), length, 'Rapid taps add one entry, replacing the existing forward branch');
  await back(); await idle('/settings', 'Settings');
  await page.getByRole('link', { name: /Progress/ }).click(); await idle('/settings/progress', 'Progress');
  await page.getByRole('button', { name: /Recover progress/ }).click(); await idle('/settings/recovery', 'Recover progress');
  await back(); await idle('/settings/progress', 'Progress');
  await back(); await idle('/settings', 'Settings');
  await page.setViewportSize({ width: 390, height: 400 });
  await page.evaluate(() => window.scrollTo(0, 90));
  await page.waitForFunction(() => history.state.copticSettingsStack?.y > 0);
  const y = await page.evaluate(() => scrollY);
  await page.getByRole('link', { name: /Preferences/ }).click(); await idle('/settings/preferences', 'Preferences');
  assert.equal(await page.evaluate(() => scrollY), 0, 'Push starts at top');
  await back(); await idle('/settings', 'Settings');
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y) < 2, 'Back restores document scroll');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /Preferences/ }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Home', exact: true }).click();
  await page.waitForURL(base + '/');
  assert.equal(await page.locator('[data-settings-layer]').count(), 0, 'Tab departure removes all surfaces');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Settings', exact: true }).click();
  await idle('/settings', 'Settings');
  await open('/settings/recovery/'); await idle('/settings/recovery', 'Recover progress');
  const deepLength = await page.evaluate(() => history.length);
  await back(); await idle('/settings/progress', 'Progress');
  assert.equal(await page.evaluate(() => history.length), deepLength, 'Deep link parent replaces unknown history');
  await page.reload(); await idle('/settings/progress', 'Progress');
  await back(); await idle('/settings', 'Settings');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('link', { name: /Preferences/ }).click(); await idle('/settings/preferences', 'Preferences');
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await back(); await idle('/settings', 'Settings');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => sessionStorage.setItem('coptic-settings-motion', 'off'));
  await page.getByRole('link', { name: /Progress/ }).click(); await idle('/settings/progress', 'Progress');
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  await page.evaluate(() => sessionStorage.removeItem('coptic-settings-motion'));
  assert.deepEqual(errors, []);
  console.log('PASS Stage B: rendered push frames, persistent host/dock, Back/Forward, rapid taps, recovery, deep links, refresh, scroll, tab interruption, reduced motion and fallback.');
} finally {
  await context.close(); await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
