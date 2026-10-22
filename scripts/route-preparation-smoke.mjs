import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const root = path.resolve('out');
const output = path.resolve(process.env.ROUTE_ARTIFACTS || '.codex-temp/route-preparation');
await mkdir(output, { recursive: true });
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end('Missing asset'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const engine = process.env.ROUTE_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch({ headless: true });
const timings = [];
const tabs = ['Settings', 'Learn', 'Dictionary', 'Translator', 'Home'];
const destinations = { Settings: '/settings', Learn: '/learn', Dictionary: '/dictionary', Translator: '/translator', Home: '/' };
const clean = value => value.replace(/\/$/, '') || '/';
async function context(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, recordVideo: { dir: output }, ...options });
  // Native airplane mode still serves packaged assets. Block all external
  // services, not the local server standing in for capacitor://localhost.
  await ctx.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await ctx.addInitScript(() => {
    window.__placeholderFrames = [];
    const inspect = () => {
      const main = document.querySelector('main');
      if (main && (/Opening…|Loading your progress…/.test(main.innerText) || main.querySelector('.dictionary-placeholder'))) window.__placeholderFrames.push(main.innerText.slice(0, 160));
      requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  return ctx;
}
async function tab(page, name) {
  const start = Date.now();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name, exact: true }).click();
  await page.waitForURL(url => clean(url.pathname) === destinations[name]);
  await page.locator('main h1').first().waitFor();
  timings.push({ tab: name, milliseconds: Date.now() - start });
}
try {
  // Each first tap starts with an empty HTTP/router cache. Do not wait for idle
  // before tapping: the first screen must survive incomplete preparation.
  for (const name of tabs) {
    console.log(`Cold first entry: ${name}`);
    const ctx = await context({ colorScheme: name === 'Translator' ? 'dark' : 'light', reducedMotion: name === 'Learn' ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + (name === 'Home' ? '/dictionary/' : '/'), { waitUntil: 'domcontentloaded' });
    await page.locator('main h1').first().waitFor();
    await tab(page, name);
    await page.screenshot({ path: path.join(output, `cold-${name}.png`) });
    await tab(page, name === 'Home' ? 'Settings' : 'Home');
    await tab(page, name);
    assert.deepEqual(await page.evaluate(() => window.__placeholderFrames), []);
    assert.deepEqual(errors, [], `${name}: no hydration/runtime errors`);
    await ctx.close();
  }

  const ctx = await context(), page = await ctx.newPage(), speculative = [];
  page.on('request', request => {
    if (request.headers()['next-router-prefetch']) speculative.push(request.url());
  });
  console.log('Bounded warmup and repeat navigation');
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => performance.getEntriesByType('mark').filter(mark => mark.name.startsWith('coptic-route-ready:')).length === 4);
  const prepared = new Set(await page.evaluate(() => performance.getEntriesByType('mark').filter(mark => mark.name.startsWith('coptic-route-ready:')).map(mark => mark.name.slice('coptic-route-ready:'.length).replace(/\/$/, '') || '/')));
  assert.deepEqual(speculative, [], 'No speculative RSC fetches that WebKit can abort on reload');
  for (const route of ['/settings', '/learn', '/dictionary', '/translator']) assert(prepared.has(route), `Prepared ${route}: ${[...prepared]}`);
  assert(![...prepared].some(route => /\/learn\/.+/.test(route)), 'No lesson catalogue speculation');
  // Route preparation must not mount dictionary workers or start translation.
  assert.equal(page.workers().length, 0);
  for (const name of [...tabs, ...tabs]) await tab(page, name);
  assert.deepEqual(await page.evaluate(() => window.__placeholderFrames), []);
  await ctx.close();

  const slow = await context(), slowPage = await slow.newPage();
  await slow.route('**/learn/**/*.txt*', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
  console.log('Slow route retains the current screen');
  await slowPage.goto(base, { waitUntil: 'domcontentloaded' });
  await slowPage.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Learn', exact: true }).click();
  await slowPage.waitForTimeout(250);
  await slowPage.getByRole('heading', { name: 'CoptLingo', exact: true }).waitFor({ timeout: 500 });
  await slowPage.waitForURL(url => clean(url.pathname) === '/learn');
  await slowPage.locator('main h1').first().waitFor();
  assert.deepEqual(await slowPage.evaluate(() => window.__placeholderFrames), []);
  await slow.close();

  // Missing local data retains the real dictionary controls and a retry action.
  const failed = await context(), failedPage = await failed.newPage();
  await failed.route('**/bohairic_dictionary.json', route => route.fulfill({ status: 404, body: 'Missing asset' }));
  console.log('Missing local dictionary resource can retry');
  await failedPage.goto(base + '/dictionary/entry/?lemma=test', { waitUntil: 'domcontentloaded' });
  await failedPage.getByRole('alert').filter({ hasText: 'Failed to load dictionary' }).waitFor();
  await failedPage.getByRole('button', { name: 'Retry', exact: true }).click();
  await failedPage.getByRole('alert').filter({ hasText: 'Failed to load dictionary' }).waitFor();
  await failed.close();
  await writeFile(path.join(output, 'timings.json'), JSON.stringify(timings, null, 2));
  console.log(JSON.stringify({ browser: engine.name(), timings, prepared: [...prepared], result: 'passed' }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
