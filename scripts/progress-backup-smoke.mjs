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
  const original = JSON.stringify({ xp: 20, streak: 2, lastCompletedDate: null, completedLessons: ['old'] });
  const previous = JSON.stringify({ xp: 5, streak: 1, lastCompletedDate: null, completedLessons: [] });
  const beforeCloud = JSON.stringify({ xp: 10, streak: 1, lastCompletedDate: null, completedLessons: ['cloud'] });
  await page.addInitScript(({ originalRaw, previousRaw, cloudRaw }) => {
    if (localStorage.getItem('__recovery-smoke-seeded') === 'true') return;
    localStorage.setItem('coptic-progress', originalRaw);
    localStorage.setItem('coptic-progress-recovery:v1', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), records: { 'coptic-progress': previousRaw } }));
    localStorage.setItem('coptic-progress-cloud-recovery:v1', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), records: { 'coptic-progress': cloudRaw } }));
    localStorage.setItem('__recovery-smoke-seeded', 'true');
  }, { originalRaw: original, previousRaw: previous, cloudRaw: beforeCloud });
  await page.goto(`${base}/settings/`); await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.getByRole('link', { name: /Progress/u }).click();
  await page.getByRole('heading', { name: 'Progress', exact: true }).waitFor();
  await page.waitForLoadState('networkidle');
  for (const hidden of ['Export Progress', 'Import Progress']) assert.equal(await page.getByText(hidden, { exact: true }).count(), 0, `${hidden} remains hidden`);

  await page.getByRole('button', { name: 'Recover previous progress' }).click();
  await page.getByRole('group', { name: 'Confirm progress recovery' }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('coptic-progress')), original, 'Cancel keeps current progress');

  await page.getByRole('button', { name: 'Recover previous progress' }).click();
  await page.getByRole('button', { name: 'Restore recovery copy' }).click();
  await page.getByRole('status').filter({ hasText: 'Recovery copy restored' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('coptic-progress')), previous, 'Previous progress is restored');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('coptic-progress-recovery:v1')).records['coptic-progress']), original, 'Pre-restore progress is retained as recovery');

  const current = JSON.stringify({ xp: 80, streak: 4, lastCompletedDate: null, completedLessons: ['new'] });
  await page.evaluate(raw => localStorage.setItem('coptic-progress', raw), current);
  await page.getByRole('button', { name: 'Recover progress from before the last cloud restore' }).click();
  await page.getByRole('button', { name: 'Restore recovery copy' }).click();
  await page.getByRole('status').filter({ hasText: 'Recovery copy restored' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('coptic-progress')), beforeCloud, 'Pre-cloud-restore progress is recoverable');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('coptic-progress-recovery:v1')).records['coptic-progress']), current, 'Current progress is protected before cloud recovery');

  await page.evaluate(() => localStorage.setItem('coptic-unit-progress:damaged', '{broken'));
  await page.reload();
  await page.getByRole('alert').filter({ hasText: 'Some saved progress' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('coptic-unit-progress:damaged')), '{broken', 'Damaged data is preserved for recovery');

  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage access denied'); };
    Storage.prototype.setItem = () => { throw new Error('Storage access denied'); };
  });
  const blockedPage = await blocked.newPage();
  const blockedErrors = [];
  blockedPage.on('pageerror', error => blockedErrors.push(error.message));
  await blockedPage.goto(`${base}/settings/progress/`);
  await blockedPage.locator('aside[role="alert"]').filter({ hasText: 'Storage access denied' }).waitFor();
  assert.ok(blockedErrors.every(message => message.includes('Storage access denied')), `Unexpected blocked-storage errors: ${blockedErrors.join('; ')}`);
  await blocked.close();
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(os.tmpdir(), 'coptic-progress-recovery.png'), fullPage: true });
  console.log('Progress recovery mobile UI: hidden manual import/export, cancellation, local recovery, pre-cloud recovery, damaged-data preservation, and storage failure passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
