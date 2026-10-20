import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';

const root = path.resolve('out');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain' };
const server = http.createServer(async (request, response) => {
  try {
    let file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) throw Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${base}/settings/`); await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.goto(`${base}/settings/progress/`); await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Progress', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Recovery', exact: true }).waitFor();
  for (const hidden of ['Export Progress', 'Import Progress']) assert.equal(await page.getByText(hidden, { exact: true }).count(), 0, `${hidden} remains hidden`);
  assert.match(await page.locator('body').innerText(), /Progress changes are protected by validated snapshots and recovery journals/u);
  assert.match(await page.locator('body').innerText(), /No recovery copy is currently available/u);
  assert.equal(await page.getByRole('button', { name: /Recover/u }).count(), 0, 'Recovery is offered only when a saved recovery copy exists');

  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(os.tmpdir(), 'coptic-progress-recovery.png'), fullPage: true });
  console.log('Progress recovery mobile UI: validated recovery messaging, conditional recovery actions, and hidden manual import/export passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
