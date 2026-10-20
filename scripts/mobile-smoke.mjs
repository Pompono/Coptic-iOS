import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, access, stat } from 'node:fs/promises';
import { startLesson, checkLearning, finishTransfer } from './learning-smoke.mjs';
import { checkLessonLayouts } from './lesson-layout-smoke.mjs';
import { checkDesign } from './design-smoke.mjs';
import { checkDictionary } from './dictionary-smoke.mjs';
import { checkScanner } from './scanner/smoke.mjs';
import { checkHostedTranslation } from './translation-smoke.mjs';
import { checkReading } from './reading-smoke.mjs';
import { checkRecordingFailure } from './recording-failure-smoke.mjs';
import { checkDarkTheme } from './dark-theme-smoke.mjs';
import { checkKeyboardPrompt } from './keyboard-prompt-smoke.mjs';
import { checkScrollBounds } from './scroll-smoke.mjs';

const root = path.resolve('out');
const types = { '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
async function checkSettingsLayout(page) {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => {
    document.documentElement.dataset.largeText = 'true';
    document.documentElement.style.fontSize = '180%';
    const fixture = document.createElement('section');
    fixture.className = 'settings-group settings-group--content account-settings-card';
    fixture.setAttribute('aria-label', 'Long account identity layout fixture');
    fixture.innerHTML = '<div class="accountInfo"><label class="field">Display name<input value="A long display name for a learner account"></label><div class="field">Email address<span class="readOnlyValue">learner.with.a.long.address.for.mobile.layout@example.invalid</span><span class="status">Email not verified</span></div></div><div class="accountActions"><button type="button">Change password</button><button type="button">Sign Out</button></div>';
    document.querySelector('.settings-page').append(fixture);
  });
  const result = await page.evaluate(() => {
    const email = document.querySelector('[aria-label="Long account identity layout fixture"] .readOnlyValue');
    const buttons = [...document.querySelectorAll('[aria-label="Long account identity layout fixture"] button')];
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      emailFits: email.scrollWidth <= email.clientWidth + 1,
      buttonHeights: buttons.map(button => button.getBoundingClientRect().height),
    };
  });
  assert.ok(result.document <= result.viewport + 1, 'Settings has no horizontal overflow at a narrow, large-text viewport');
  assert.equal(result.emailFits, true, 'Long account emails wrap within their content column');
  assert.ok(result.buttonHeights.every(height => height >= 44), 'Account actions remain large enough to tap with large text');
  await page.evaluate(() => {
    document.querySelector('[aria-label="Long account identity layout fixture"]').remove();
    delete document.documentElement.dataset.largeText;
    document.documentElement.style.removeProperty('font-size');
  });
  await page.setViewportSize({ width: 390, height: 844 });
}
try {
  const engine = process.env.COPTIC_BROWSER === 'webkit' ? webkit : chromium;
  browser = await engine.launch({ headless: true });
  await checkDesign(browser, base);
  await checkLessonLayouts(browser, base);
  await checkLearning(browser, base);
  await checkDictionary(browser, base);
  await checkKeyboardPrompt(browser, base);
  await checkRecordingFailure(browser, base);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const externalRequests = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    // WebKit can route local blob images; those are in-memory photo assets,
    // not external network requests. Chromium doesn't expose them here.
    if (url.startsWith(base + '/') || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await context.addInitScript(() => {
    window.__lessonAudioStarts = [];
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.__copyFails)throw new Error('Clipboard failure');window.__copiedTranslation=text;}}});
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer?.duration > .01) window.__lessonAudioStarts.push({ duration: this.buffer.duration, state: this.context.state });
      return start.apply(this, args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
  const unit = '/learn/section-1-unit-01-pair-letters-and-sounds/';
  for (const route of ['/', '/learn/', unit, unit + 'play/lesson-1-a-o-d/', '/dictionary/', '/dictionary/entry/?lemma=%E2%B2%81', '/settings/', '/settings/account/', '/settings/preferences/', '/settings/progress/', '/settings/keyboard/', '/settings/recovery/', '/translator/']) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    await page.waitForLoadState('networkidle');
    if (route.includes('/play/')) {
      await startLesson(page);
      await page.getByRole('button', { name: 'Check', exact: true }).waitFor();
      assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation' }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), 'Full-screen exercises do not reserve extra dock space');
      await page.locator('.lesson-audio-card').first().click();
      await page.waitForFunction(() => window.__lessonAudioStarts.some(audio => audio.state === 'running' && audio.duration > .01));
      console.log('PASS: tapping the actual lesson card starts a bundled recording in a running audio context.');
      // Complete the introductory a/o/d lesson as a learner would. Answer
      // buttons are located by text because their positions are randomized.
      const answers = ['ⲁ', 'a', 'a', 'dha', 'dha', 'ⲇⲁ', 'o', 'o', 'ⲟ', 'dho', 'ⲇⲟ', 'dhad', 'dho', 'ⲇⲁⲇ', 'dhod', 'dhod', 'ⲇⲟⲇ', 'dhad', 'dha'];
      for (const answer of answers) {
        const check = page.getByRole('button', { name: 'Check', exact: true });
        await check.waitFor();
        await page.getByRole('button', { name: answer, exact: true }).click();
        await check.click();
        const next = page.getByRole('button', { name: 'Continue', exact: true });
        await next.waitFor();
        assert.equal(await page.getByText(/Not quite/).count(), 0);
        await next.click();
        await page.waitForTimeout(300);
      }
      await finishTransfer(page, 'a-o-d-letters-and-sounds');
      const key = 'coptic-unit-progress:section-1-unit-01-pair-letters-and-sounds';
      assert.ok(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).includes('lesson-1-a-o-d'));
      await page.goto(base + unit);
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');
      assert.ok(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).includes('lesson-1-a-o-d'));
    }
    if (route === '/dictionary/') await page.locator('.dictionary-results[data-state="ready"]').waitFor();
    if (route === '/settings/') {
      await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
      for (const title of ['Preferences', 'Progress', 'Keyboard']) await page.getByRole('link', { name: new RegExp(title, 'u') }).waitFor();
      assert.equal(await page.locator('.settings-navigation__row').count(), 3);
      assert.equal(await page.locator('.settings-navigation__row').filter({ hasText: 'Account' }).count(), 0);
      assert.equal(await page.getByText('Enable Cloud Sync', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Export Progress', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Import Progress', { exact: true }).count(), 0);
      await checkSettingsLayout(page);
    }
    if (route === '/settings/preferences/') {
      await page.getByRole('heading', { name: 'Preferences', exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('dark');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('theme-mode')), 'dark');
      await page.getByRole('combobox', { name: 'Appearance', exact: true }).selectOption('light');
    }
    if (route === '/settings/progress/') {
      await page.getByRole('heading', { name: 'Cloud sync', exact: true }).waitFor();
      assert.match(await page.locator('body').innerText(), /Progress stays on this device while signed out/u);
      assert.equal(await page.getByText('Enable Cloud Sync', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Export Progress', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Import Progress', { exact: true }).count(), 0);
    }
    if (route === '/settings/keyboard/') {
      assert.ok(await page.getByRole('link', { name: /Download the Coptic Keyboard app on the App Store/u }).count());
    }
    // WebKit reports aborted speculative fetches as page errors if a test
    // tears down the document while Next's link prefetches are still running.
    await page.waitForLoadState('networkidle');
  }
  const localModel = await access('out/models/coptic-english/manifest.json').then(() => true).catch(() => false);
  await checkHostedTranslation(page, context);
  await page.waitForLoadState('networkidle');
  try { await checkScanner(page, base, localModel); }
  catch (failure) {
    console.error('Scanner failure snapshot:', (await page.locator('body').innerText()).slice(0, 3000));
    console.error('Page errors:', errors);
    console.error('Blocked external requests:', externalRequests);
    throw failure;
  }
  // Warm asset caches made async startup race HTML parsing intermittently.
  await checkReading(page, base);
  await checkScrollBounds(page, base);
  await checkDarkTheme(page, base);
  // Exercise full document startup on the routes that exposed that race.
  for (let pass = 0; pass < 4; pass++) {
    for (const route of ['/learn/', unit, '/dictionary/entry/?lemma=%E2%B2%81']) {
      await page.goto(base + route);
      await page.waitForLoadState('networkidle');
    }
  }
  const audio = await page.request.get(base + '/audio/learn/shared/a.mp3');
  assert.equal(audio.status(), 200);
  assert.ok((await audio.body()).length > 1000);
  const duration = await page.evaluate(async () => {
    const context = new AudioContext();
    try {
      const data = await (await fetch('/audio/learn/shared/a.mp3')).arrayBuffer();
      return (await context.decodeAudioData(data)).duration;
    } finally { await context.close(); }
  });
  assert.ok(duration > 0, 'Bundled pronunciation audio decodes successfully');
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, [], 'No external requests are needed for bundled features');
  console.log('PASS: mobile pages, full lesson completion, saved progress/settings, dictionary, audio decoding, and translation configuration with external networking blocked.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
