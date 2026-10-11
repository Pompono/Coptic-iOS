import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const root = path.resolve('out');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
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
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
  const unit = '/learn/section-1-unit-01-pair-letters-and-sounds/';
  for (const route of ['/', '/learn/', unit, unit + 'play/lesson-1-a-o-d/', '/dictionary/', '/dictionary/entry/?lemma=%E2%B2%81', '/settings/', '/translator/']) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    if (route.includes('/play/')) {
      await page.getByRole('button', { name: 'Check', exact: true }).waitFor();
      assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation' }).count(), 0);
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
      await page.reload();
      assert.ok(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).includes('lesson-1-a-o-d'));
    }
    if (route === '/dictionary/') await page.getByText(/shown.*total/).waitFor();
    if (route === '/settings/') {
      await page.getByRole('button', { name: 'Dark', exact: true }).click();
      await page.reload();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('theme-mode')), 'dark');
      await page.getByRole('button', { name: 'Light', exact: true }).click();
    }
    await page.waitForTimeout(250);
  }
  await page.locator('input').first().fill('ⲡⲉⲛⲛⲟⲩϯ');
  await page.getByRole('button', { name: 'Translate', exact: true }).click();
  if (!process.env.NEXT_PUBLIC_TRANSLATION_API_URL) {
    await page.getByText(/Translation is not configured yet/).waitFor();
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
  console.log('PASS: mobile pages, full lesson completion, saved progress/settings, dictionary, audio decoding, and translation configuration with external networking blocked.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
