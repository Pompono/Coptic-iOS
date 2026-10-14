import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, access, stat } from 'node:fs/promises';
import { checkScanner } from './scanner/smoke.mjs';
import { checkReading } from './reading-smoke.mjs';
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
try {
  const engine = process.env.COPTIC_BROWSER === 'webkit' ? webkit : chromium;
  browser = await engine.launch({ headless: true });
  await checkKeyboardPrompt(browser, base);
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
  for (const route of ['/', '/learn/', unit, unit + 'play/lesson-1-a-o-d/', '/dictionary/', '/dictionary/entry/?lemma=%E2%B2%81', '/settings/', '/translator/']) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    await page.waitForLoadState('networkidle');
    if (route.includes('/play/')) {
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
      const key = 'coptic-unit-progress:section-1-unit-01-pair-letters-and-sounds';
      assert.ok(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).includes('lesson-1-a-o-d'));
      await page.goto(base + unit);
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');
      assert.ok(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).includes('lesson-1-a-o-d'));
    }
    if (route === '/dictionary/') await page.getByText(/shown.*total/).waitFor();
    if (route === '/settings/') {
      await page.getByRole('button', { name: 'Dark', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('theme-mode')), 'dark');
      await page.getByRole('button', { name: 'Light', exact: true }).click();
    }
    // WebKit reports aborted speculative fetches as page errors if a test
    // tears down the document while Next's link prefetches are still running.
    await page.waitForLoadState('networkidle');
  }
  const localModel = await access('out/models/coptic-english/manifest.json').then(() => true).catch(() => false);
  if (localModel) {
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
  }
  if (localModel) {
    await page.locator('input').first().fill('ⲛⲑⲟ ⲧⲉ ϯϩⲣⲏⲣⲓ: ⲛ̀ⲧⲉ ⲡⲓⲥⲑⲟⲓⲛⲟⲩϥⲓ: ⲑⲏⲉⲧⲁⲥⲫⲓⲣⲓ ⲉ̀ⲃⲟⲗ: ϧⲉⲛ ⲑⲛⲟⲩⲛⲓ ⲛ̀ⲓⲉⲥⲥⲉ.');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByText('You are the flower, of incense, that has blossomed, from the root of Jesse.').waitFor();
    await page.getByText(/Published translation · Coptic Corpora/).waitFor();
    await page.locator('input').first().fill('[[ⲑⲟ ⲧⲉ ϯϩⲣⲏⲣⲓ');
    assert.equal(await page.getByText('You are the flower, of incense, that has blossomed, from the root of Jesse.').count(), 0, 'Editing text invalidates the previous published result immediately');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByText(/No unambiguous published translation/).waitFor();
    assert.equal(await page.getByText('You are the flower, of incense, that has blossomed, from the root of Jesse.').count(), 0);
    await page.getByLabel('Translation method').selectOption('experimental');
    console.log('PASS: source-matched flower/incense/Jesse stanza and explicit refusal of damaged OCR.');
  }
  await page.locator('input').first().fill('ⲡⲉⲛⲛⲟⲩϯ');
  await page.getByRole('button', { name: 'Translate', exact: true }).click();
  if (localModel) {
    await page.getByRole('button', { name: 'Translate', exact: true }).waitFor({ timeout: 180000 });
    assert.match(await page.locator('body').innerText(), /our God/i);
    await page.locator('input').first().fill('ⲓⲏⲥ ⲡⲭⲥ');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByRole('button', { name: 'Translate', exact: true }).waitFor({ timeout: 180000 });
    assert.match(await page.locator('body').innerText(), /Jesus Christ/i);
    console.log('PASS: both model translations ran with navigator.onLine=false and external requests blocked.');
    await page.locator('input').first().fill('ⲛⲑⲟ ⲧⲉ ⲧϣⲉⲣⲓ');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByRole('button', { name: 'Translate', exact: true }).waitFor({ timeout: 180000 });
    assert.match(await page.locator('body').innerText(), /You are the daughter/i);
    console.log('PASS: beam decoder preserves daughter rather than the old greedy Son output.');
    await page.locator('input').first().fill('ⲁⲛⲟⲕ ⲟⲩⲣⲱⲙⲓ ⲡⲉ. ⲛⲑⲟ ⲟⲩⲥϩⲓⲙⲓ ⲧⲉ.');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByRole('button', { name: 'Translate', exact: true }).waitFor({ timeout: 180000 });
    await page.getByText('Review each draft passage', { exact: true }).click();
    assert.match(await page.locator('body').innerText(), /I am a man/i);
    assert.match(await page.locator('body').innerText(), /(?:you are|thou art) a woman/i);
    await page.getByText('Unverified AI draft', { exact: true }).waitFor();
    console.log('PASS: unfamiliar composed text translates through the model in two complete passages.');
    await page.locator('input').first().fill('ⲁ'.repeat(700));
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByText(/One sentence exceeds the local model’s trained length/).waitFor();
    assert.equal(await page.getByText('Unverified AI draft', { exact: true }).count(), 0, 'An overlength failure clears earlier English instead of accepting partial output');



    await page.locator('input').first().fill('ⲉ 4 ⲙⲁⲣⲓⲁ: ⲍ □ ⲛⲁⲛ');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByText(/Correct the Coptic text before translating/).waitFor();
    await page.locator('input').first().fill('ⲛⲑⲟ ⲧⲉ ⲧϣⲏⲣⲓ: ⲛ̀ⲧⲉ ⲡⲓⲑⲙⲏⲓⲛⲟⲩϯ: ⲑⲏⲉⲧⲁⲥϥⲓⲣⲓ ⲉ̀ⲃⲟⲗ: ϧⲉⲛ ⲑⲛⲟⲩⲛⲓ ⲛ̀ⲓⲉⲥⲥⲉ.');
    await page.getByRole('button', { name: 'Translate', exact: true }).click();
    await page.getByRole('button', { name: 'Translate', exact: true }).waitFor({ timeout: 180000 });
    console.log('Photo passage with manually transcribed Coptic:', await page.locator('body').innerText());

  } else if (!process.env.NEXT_PUBLIC_TRANSLATION_API_URL) {
    await page.getByText(/Translation is not configured yet/).waitFor();
  }
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
