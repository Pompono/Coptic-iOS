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
  browser = await chromium.launch({ headless: true, timeout: 15000, executablePath: process.env.COPTIC_BROWSER_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const nativeAnimate = Element.prototype.animate;
    window.__settingsSmokeAnimations = [];
    Element.prototype.animate = function (keyframes, options) {
      window.__settingsSmokeAnimations.push({ snapshot: this.hasAttribute('data-settings-snapshot'), keyframes });
      return nativeAnimate.call(this, keyframes, options);
    };
  });
  const waitForPath = path => page.waitForURL(url => url.pathname.replace(/\/$/u, '') === path);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, title, screenshot] of [
    ['/settings/', 'Settings', 'settings-home.png'],
    ['/settings/account/?mode=settings', 'Account', 'settings-account.png'],
    ['/settings/preferences/', 'Preferences', 'settings-preferences.png'],
    ['/settings/progress/', 'Progress', 'settings-progress.png'],
    ['/settings/recovery/', 'Recover progress', 'settings-recovery.png'],
    ['/learn/', 'Learn', 'learn-path.png'],
  ]) {
    const response = await page.goto(base + route);
    console.log(`Loaded ${route}`);
    assert.equal(response.status(), 200, route);
    await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').count(), 1, `${route} has one page title`);
    if (route === '/settings/') {
      for (const category of ['Preferences', 'Progress']) await page.getByRole('link', { name: new RegExp(category, 'u') }).waitFor();
      assert.equal(await page.locator('.settings-navigation__row').count(), 2, 'Settings has two primary categories');
      assert.equal(await page.getByRole('link', { name: 'Keyboard', exact: true }).count(), 0, 'Settings has no Keyboard navigation item');
      const keyboardDownload = page.locator('.settings-keyboard-install__card');
      assert.equal(await keyboardDownload.getByText('Type with the iOS Coptic keyboard', { exact: true }).count(), 1);
      assert.match(await keyboardDownload.getByRole('link').getAttribute('href'), /apps\.apple\.com\/us\/app\/coptic-keyboard\/id1510907422/u);
      const navRows = await page.locator('.settings-navigation__row').evaluateAll(rows => rows.map(row => ({ top: row.getBoundingClientRect().top, bottom: row.getBoundingClientRect().bottom })));
      assert.ok(navRows[1].top - navRows[0].bottom >= 8, 'Settings categories have a visible gap between cards');
      const topSpacing = await page.evaluate(() => {
        const header = document.querySelector('.settings-home > .page-header').getBoundingClientRect();
        const profile = document.querySelector('.settings-account-entry').getBoundingClientRect();
        const firstCategory = document.querySelector('.settings-navigation__row').getBoundingClientRect();
        return { headerToProfile: profile.top - header.bottom, profileToCategory: firstCategory.top - profile.bottom };
      });
      assert.ok(topSpacing.headerToProfile >= 20, 'Settings heading has breathing room before the profile card');
      assert.ok(topSpacing.profileToCategory >= 20, 'Profile card has breathing room before Preferences');
      assert.ok(await page.locator('.settings-navigation__icon.is-learning svg').count(), 'Preferences uses the adjustment controls icon');
      const dockTop = await page.locator('.mobile-chin-dock').evaluate(node => node.getBoundingClientRect().top);
      await page.getByRole('link', { name: /Preferences/u }).click();
      await waitForPath('/settings/preferences');
      const submenuSpacing = await page.evaluate(() => {
        const title = document.querySelector('.settings-subpage > .page-header').getBoundingClientRect();
        const firstCard = document.querySelector('.settings-subpage > section').getBoundingClientRect();
        return firstCard.top - title.bottom;
      });
      assert.ok(submenuSpacing >= 24, 'Preferences heading has a shared 24px gap before its first card');
      assert.equal(await page.locator('.mobile-chin-dock').evaluate(node => node.getBoundingClientRect().top), dockTop, 'Bottom navigation stays fixed during the Settings transition');
      await page.goBack();
      await waitForPath('/settings');
      await page.goForward();
      await waitForPath('/settings/preferences');
      await page.getByRole('main').getByRole('link', { name: 'Settings', exact: true }).click();
      await waitForPath('/settings');
      assert.equal(await page.locator('.settings-home > .page-header h1').textContent(), 'Settings', 'The Settings back row returns to the previous history entry');
      await page.evaluate(() => { window.__settingsSmokeAnimations.length = 0; });
      await page.getByRole('link', { name: /Progress/u }).click();
      await waitForPath('/settings/progress');
      await page.waitForFunction(() => window.__settingsSmokeAnimations?.length >= 2);
      const fallbackTransform = await page.evaluate(() => window.__settingsSmokeAnimations.find(animation => !animation.snapshot)?.keyframes?.[0]?.transform);
      assert.equal(fallbackTransform, 'translateX(100%)', 'Older WebViews animate the incoming Settings page with the fallback');
      await page.waitForFunction(() => document.querySelector('[data-settings-snapshot]') === null);
      await page.getByRole('button', { name: /Recover progress/u }).click();
      await waitForPath('/settings/recovery');
      await page.getByRole('main').getByRole('link', { name: 'Settings', exact: true }).click();
      await waitForPath('/settings/progress');
      await page.getByRole('main').getByRole('link', { name: 'Settings', exact: true }).click();
      await waitForPath('/settings');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: /Sign In \/ Create Account/u }).click();
      await waitForPath('/settings/account');
      assert.equal(new URL(page.url()).searchParams.get('mode'), 'sign-in');
      assert.equal(await page.locator('[data-settings-snapshot]').count(), 0, 'Reduce Motion skips the fallback transition');
      await page.getByRole('main').getByRole('link', { name: 'Settings', exact: true }).click();
      await waitForPath('/settings');
      await page.setViewportSize({ width: 320, height: 740 });
      const narrowLayout = await page.evaluate(() => {
        const card = document.querySelector('.settings-keyboard-install__card');
        const label = card.querySelector('p').getBoundingClientRect();
        const badge = card.querySelector('a').getBoundingClientRect();
        return { viewport: document.documentElement.clientWidth, width: document.documentElement.scrollWidth, overlap: label.right > badge.left };
      });
      assert.ok(narrowLayout.width <= narrowLayout.viewport + 1, 'Settings has no horizontal overflow on a narrow iPhone');
      assert.equal(narrowLayout.overlap, false, 'Keyboard label and App Store badge stay side by side on a narrow iPhone');
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('.settings-navigation__row').filter({ hasText: 'Account' }).count(), 0, 'Account is only available from the profile entry');
      assert.equal(await page.getByText('Developer', { exact: true }).count(), 0);
    }
    if (route.startsWith('/settings/') && route !== '/settings/') {
      assert.equal(await page.locator('.mobile-chin-dock__item[aria-current="page"][aria-label="Settings"]').count(), 1, 'Settings stays selected in a submenu');
      await page.getByRole('link', { name: 'Settings', exact: true }).first().waitFor();
    }
    if (route === '/settings/progress/') {
      assert.match(await page.locator('body').innerText(), /Progress stays on this device|Synced|Syncing|Offline|Pending|Needs attention|Error|Unavailable/u);
      for (const removed of ['Enable Cloud Sync', 'Export Progress', 'Import Progress']) assert.equal(await page.getByText(removed, { exact: true }).count(), 0, removed);
    }
    if (route === '/settings/preferences/') {
      await page.getByLabel('Appearance').selectOption('dark');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.getByLabel('Appearance').selectOption('light');
      const fonts = page.getByLabel('Coptic font');
      assert.deepEqual(await fonts.locator('option').allTextContents(), ['Modern', 'Classic']);
      assert.equal(await fonts.inputValue(), 'avva', 'Modern is the default when no font preference has been saved');
      await fonts.selectOption('unicode');
      assert.equal(await page.evaluate(() => localStorage.getItem('coptic-font-mode')), 'unicode');
      await page.reload();
      assert.equal(await page.getByLabel('Coptic font').inputValue(), 'unicode', 'saved font selection remains selected');
      await page.getByLabel('Coptic font').selectOption('avva');
      await page.reload();
      assert.equal(await page.getByLabel('Coptic font').inputValue(), 'avva', 'screenshot shows the Modern default after persistence coverage');
    }
    if (route === '/settings/account/?mode=settings') {
      assert.equal(await page.getByRole('heading', { name: 'Account settings', exact: true }).count(), 0);
    }
    await page.screenshot({ path: path.join(screenshots, screenshot), fullPage: true });
    if (route === '/settings/') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await page.screenshot({ path: path.join(screenshots, 'final-settings-dark.png'), fullPage: true });
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      await page.screenshot({ path: path.join(screenshots, 'final-settings-light.png'), fullPage: true });
      const keyboardSection = page.locator('.settings-keyboard-install');
      await page.setViewportSize({ width: 390, height: 400 });
      await keyboardSection.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 100));
      assert.ok(await page.evaluate(() => window.scrollY > 0), 'Keyboard screenshot shows the Settings page scrolled to its bottom section');
      const keyboardRowBox = await page.locator('.settings-keyboard-install__card').boundingBox();
      const dockBox = await page.getByRole('navigation', { name: 'Mobile navigation' }).boundingBox();
      assert.ok(keyboardRowBox.y + keyboardRowBox.height < dockBox.y, 'Keyboard row is fully visible above the fixed tab bar');
      await page.screenshot({ path: path.join(screenshots, 'final-settings-keyboard.png') });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    if (route === '/learn/') await page.screenshot({ path: path.join(screenshots, 'final-learn.png'), fullPage: false });
    if (route === '/settings/preferences/') {
      await page.getByLabel('Appearance').selectOption('dark');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    } else await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.screenshot({ path: path.join(screenshots, screenshot.replace('.png', '-dark.png')), fullPage: true });
    if (route === '/settings/preferences/') {
      await page.getByLabel('Appearance').selectOption('light');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    }
    else await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: Settings home, four Settings subpages, and Learn at 390×844; account entry, font preference, recovery route, and removed backup/sync controls validated. Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
