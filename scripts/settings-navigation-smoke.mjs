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
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Not found'); }
});
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.SETTINGS_SMOKE_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const browserType = process.env.SETTINGS_BROWSER === 'webkit' ? webkit : chromium;
const browser = await browserType.launch({ headless: true, executablePath: process.env.COPTIC_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'no-preference', recordVideo: { dir: output, size: { width: 390, height: 844 } } });
const page = await context.newPage();
if (process.env.SETTINGS_SMOKE_BASE_URL) page.setDefaultNavigationTimeout(120000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const clean = value => value.replace(/\/$/, '');
const idle = async (route, title) => {
  await page.waitForURL(url => clean(url.pathname) === clean(route));
  // Static export hydration drains React's server-stream staging boundary.
  // Assert one actual host after that lifecycle, not during HTML handoff.
  await page.waitForFunction(() => document.querySelectorAll('.settings-navigation-host').length === 1);
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
// Seek real compositor animations to known times, so a busy CI worker cannot
// skip every intermediate frame between two polling samples.
const pauseTransitions = () => page.evaluate(() => {
  window.__held = [];
  window.__originalAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const animation = window.__originalAnimate.apply(this, args);
    if (this.classList.contains('settings-navigation-surface')) {
      animation.pause(); animation.currentTime = 0; window.__held.push(animation);
    }
    return animation;
  };
});
const sampleTransition = async time => {
  await page.waitForFunction(() => window.__held.length === 2);
  return page.evaluate(async time => {
    window.__held.forEach(animation => { animation.currentTime = time; });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return [...document.querySelectorAll('[data-settings-layer]')].map(node => ({ path: node.dataset.settingsLayer, x: node.getBoundingClientRect().x, inert: node.inert }));
  }, time);
};
const resumeTransitions = () => page.evaluate(() => {
  Element.prototype.animate = window.__originalAnimate;
  window.__held.forEach(animation => animation.play());
});
try {
  await open('/settings/');
  await idle('/settings', 'Settings');
  await page.evaluate(() => {
    window.__host = document.querySelector('.settings-navigation-host');
    window.__dock = document.querySelector('.mobile-chin-dock');
  });
  await pauseTransitions();
  await page.getByRole('link', { name: /Preferences/ }).click();
  const frames = [await sampleTransition(75), await sampleTransition(150)];
  await page.screenshot({ path: path.join(output, 'push-midpoint.png') });
  await resumeTransitions();
  await idle('/settings/preferences', 'Preferences');
  const mid = frames.filter(frame => frame.length === 2 && frame[1].x > 1 && frame[1].x < 389);
  assert.ok(mid.length > 1, 'Push actually renders intermediate transformed positions');
  assert.ok(mid.every(frame => frame[0].x < 0 && frame.every(layer => layer.inert)), 'Outgoing parallax and inert layers');
  assert.ok(await page.evaluate(() => window.__host === document.querySelector('.settings-navigation-host') && window.__dock === document.querySelector('.mobile-chin-dock')), 'Host and dock DOM identities persist');
  await page.screenshot({ path: path.join(output, 'preferences-settled.png') });
  await pauseTransitions();
  await back();
  const popFrames = [await sampleTransition(75), await sampleTransition(150)];
  await page.screenshot({ path: path.join(output, 'pop-midpoint.png') });
  await resumeTransitions(); await idle('/settings', 'Settings');
  assert.ok(popFrames.some(frame => frame.length === 2 && frame[0].x > 1 && frame[0].x < 389 && frame[1].x < 0), 'Pop moves current surface right while revealing the parent underneath');
  await page.getByRole('link', { name: /Preferences/ }).click();
  await page.locator('[data-settings-phase="settling"]').waitFor();
  await page.goBack(); await idle('/settings', 'Settings');
  await page.waitForTimeout(350);
  await idle('/settings', 'Settings');
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Browser Back interrupts a push without a late destination resurfacing');
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
  const scrollWrites = await page.evaluate(() => {
    const original = history.replaceState;
    let writes = 0;
    history.replaceState = function (...args) { writes++; return original.apply(this, args); };
    window.scrollTo(0, 90);
    for (let index = 0; index < 120; index++) window.dispatchEvent(new Event('scroll'));
    history.replaceState = original;
    return writes;
  });
  assert.equal(scrollWrites, 0, 'Momentum samples never write history per frame (WebKit rate limit)');
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
  await back(); await idle('/settings', 'Settings');
  await page.getByRole('link', { name: /Preferences/ }).click(); await idle('/settings/preferences', 'Preferences');
  const cdp = browserType === chromium ? await context.newCDPSession(page) : null;
  const touch = async (type, x = 8, y = 100) => {
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: /End|Cancel/.test(type) ? [] : [{ x, y }] });
    // Playwright WebKit has no touch-drag API. Exercise its real mouse pointer
    // path; Chromium above supplies trusted touch injection, not DOM dispatch.
    else if (type === 'touchStart') { await page.mouse.move(x, y); await page.mouse.down(); }
    else if (type === 'touchMove') await page.mouse.move(x, y);
    else {
      if (type === 'touchCancel') await page.locator('.settings-navigation-host').dispatchEvent('pointercancel', { pointerType: 'mouse' });
      await page.mouse.up();
    }
  };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const xOfCurrent = () => page.locator('[data-layer-role="from"]').evaluate(node => node.getBoundingClientRect().x);
  const gestureHistory = await page.evaluate(() => ({ length: history.length, state: history.state.copticSettingsStack }));
  await page.evaluate(() => { window.__current = document.querySelector('[data-settings-layer]'); });
  await touch('touchStart'); await touch('touchMove', 50); await pause(30); await touch('touchMove', 100);
  await page.locator('[data-settings-phase="tracking"]').waitFor();
  assert.ok(Math.abs(await xOfCurrent() - 92) < 2, 'Page follows finger displacement, not a release-only back event');
  assert.equal(await page.locator('[data-settings-layer]').count(), 2);
  await page.screenshot({ path: path.join(output, 'swipe-tracking-light.png') });
  await pause(140); await touch('touchEnd'); await idle('/settings/preferences', 'Preferences');
  assert.deepEqual(await page.evaluate(() => ({ length: history.length, state: history.state.copticSettingsStack })), gestureHistory, 'Cancelled gesture leaves history unchanged');
  assert.ok(await page.evaluate(() => window.__current === document.querySelector('[data-settings-layer]')), 'Cancellation preserves current React surface');
  await touch('touchStart'); await touch('touchMove', 200); await touch('touchCancel'); await idle('/settings/preferences', 'Preferences');
  assert.equal(clean(new URL(page.url()).pathname), '/settings/preferences', 'System touch cancellation cannot commit');
  await touch('touchStart'); await touch('touchMove', 12, 150); await touch('touchEnd');
  await idle('/settings/preferences', 'Preferences');
  assert.equal(await page.locator('[data-settings-layer]').count(), 1, 'Vertical drag does not mount a preview');
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await touch('touchStart', 70); await touch('touchMove', 280); await touch('touchEnd');
  await idle('/settings/preferences', 'Preferences');
  // Rejected desktop drags may select text; clear it as a user would before
  // starting a new navigation gesture. Selection is deliberately excluded.
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.evaluate(() => { window.__pops = 0; window.addEventListener('popstate', () => window.__pops++); });
  await touch('touchStart'); await touch('touchMove', 80); await pause(40); await touch('touchMove', 240);
  await pause(140); await touch('touchEnd'); await idle('/settings', 'Settings');
  assert.equal(await page.evaluate(() => window.__pops), 1, 'Distance commit traverses history exactly once');
  await touch('touchStart'); await touch('touchMove', 240); await touch('touchEnd'); await idle('/settings', 'Settings');
  assert.equal(await page.evaluate(() => window.__pops), 1, 'Settings root never swipes back');
  await page.goForward(); await idle('/settings/preferences', 'Preferences');
  await touch('touchStart'); await touch('touchMove', 25); await touch('touchMove', 85); await touch('touchEnd');
  await idle('/settings', 'Settings');
  assert.equal(await page.evaluate(() => window.__pops), 3, 'Velocity commit adds one pop after browser Forward');
  await open('/settings/recovery/'); await idle('/settings/recovery', 'Recover progress');
  const directHistory = await page.evaluate(() => history.length);
  await touch('touchStart'); await touch('touchMove', 240); await pause(140); await touch('touchEnd');
  await idle('/settings/progress', 'Progress');
  assert.equal(await page.evaluate(() => history.length), directHistory, 'Deep-entry swipe uses parent replace');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await touch('touchStart'); await touch('touchMove', 110);
  await page.locator('[data-settings-phase="tracking"]').waitFor();
  assert.deepEqual(await page.locator('[data-settings-layer]').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor)), ['rgb(8, 12, 16)', 'rgb(8, 12, 16)']);
  await page.screenshot({ path: path.join(output, 'swipe-tracking-dark.png') });
  await touch('touchCancel'); await idle('/settings/progress', 'Progress');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await touch('touchStart'); await touch('touchMove', 240); await touch('touchEnd'); await idle('/settings/progress', 'Progress');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await touch('touchStart'); await touch('touchMove', 100);
  await page.setViewportSize({ width: 400, height: 844 });
  await touch('touchCancel'); await idle('/settings/progress', 'Progress');
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Resize deterministically cancels drag');
  await touch('touchStart'); await touch('touchMove', 95);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await touch('touchCancel'); await idle('/settings/progress', 'Progress');
  await touch('touchStart'); await touch('touchMove', 100);
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Home', exact: true }).evaluate(node => node.click());
  await touch('touchCancel'); await page.waitForURL(base + '/');
  assert.equal(await page.locator('[data-settings-layer]').count(), 0, 'Tab departure during a drag leaves no Settings surfaces');
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Settings', exact: true }).click();
  await idle('/settings', 'Settings');
  await open('/settings/account/?mode=sign-in'); await idle('/settings/account', 'Account');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  if (await email.count()) {
    await email.fill('navigation-only@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('unsent-test-draft');
    await page.locator('h1').click();
    await touch('touchStart', 8, 100); await touch('touchMove', 90, 100); await pause(140); await touch('touchEnd');
    await idle('/settings/account', 'Account');
    assert.equal(await email.inputValue(), 'navigation-only@example.invalid');
    assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), 'unsent-test-draft', 'Cancelling a swipe preserves form drafts');
    await page.getByRole('button', { name: 'Create Account', exact: true }).click();
    await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Navigation draft');
    await touch('touchStart', 8, 100); await touch('touchMove', 95, 100); await touch('touchCancel');
    await idle('/settings/account', 'Account');
    assert.equal(await page.getByRole('textbox', { name: 'Display name', exact: true }).inputValue(), 'Navigation draft');
    console.log('PASS: Account form values and mode survive cancelled gestures; no form was submitted.');
  } else {
    assert.equal(process.env.SETTINGS_EXPECT_AUTH || '', '', 'Configured build must expose actual account form coverage');
    console.log('Account form coverage unavailable in this unconfigured build.');
  }
  await open('/settings/'); await idle('/settings', 'Settings');
  let releaseRoute;
  const gate = new Promise(resolve => { releaseRoute = resolve; });
  await page.route('**/settings/preferences/**', async route => { await gate; await route.continue(); });
  await page.getByRole('link', { name: /Preferences/ }).click();
  await page.locator('[data-settings-phase="pending"]').waitFor();
  assert.equal(await page.locator('[data-settings-layer]').count(), 1, 'Slow route keeps only the original page');
  assert.equal(await page.locator('h1').textContent(), 'Settings');
  releaseRoute(); await idle('/settings/preferences', 'Preferences');
  await page.unroute('**/settings/preferences/**');
  await back(); await idle('/settings', 'Settings');
  await page.evaluate(() => { Element.prototype.animate = () => { throw new Error('Injected compositor failure'); }; });
  await page.getByRole('link', { name: /Progress/ }).click(); await idle('/settings/progress', 'Progress');
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'Animation failure immediately settles one real surface');
  await back(); await idle('/settings', 'Settings');
  assert.deepEqual(errors, []);
  console.log('PASS Stage B: rendered push frames, persistent host/dock, Back/Forward, rapid taps, recovery, deep links, refresh, scroll, tab interruption, reduced motion and fallback.');
  console.log('PASS Stage C: finger-following transforms, cancellation, preserved surface/history, vertical/edge rejection, distance/velocity commits, exactly-once history, root guard, deep recovery, dark surfaces, Reduced Motion and resize.');
  console.log('PASS: delayed route rendering and runtime animation failure fallback.');
} catch (error) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close(); await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}



