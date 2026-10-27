// Entirely mocked network: no request can reach a real Supabase account.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const root = path.resolve('out');
const server = http.createServer(async (request, response) => {
  try {
    let file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const types = { '.html': 'text/html', '.txt': 'text/plain', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await (process.env.DELETION_BROWSER === 'webkit' ? webkit : chromium).launch();
const progress = JSON.stringify({ xp: 42, streak: 1, completedLessons: ['one'], lastCompletedDate: null });
try {
  for (const scenario of ['success', 'lost-response', 'unavailable']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    let deleted = false, requests = 0, uploads = 0, failUpload = false, userId = '00000000-0000-4000-8000-0000000000a1';
    const user = () => ({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'disposable@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' });
    await context.route('**/*', async route => {
      const request = route.request(), url = request.url();
      if (url.startsWith(base)) return route.continue();
      const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (url.includes('/functions/v1/account-deletion')) {
        const body = request.postDataJSON();
        if (body.action === 'ready') return json({ state: scenario === 'unavailable' ? 'unavailable' : 'available' }, scenario === 'unavailable' ? 503 : 200);
        if (body.action === 'status') return json({ state: deleted ? 'deleted' : 'not_started' });
        requests++; assert.equal(body.password, 'password-for-test'); assert.equal(body.confirmation, 'DELETE');
        assert.equal(body.userId, undefined); deleted = true;
        if (scenario === 'lost-response') return route.abort('failed');
        await new Promise(resolve => setTimeout(resolve, 100));
        return json({ state: 'deleted' });
      }
      if (url.includes('/auth/v1/token')) {
        const payload = Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
        return json({ access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fake`, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user: user() });
      }
      if (url.includes('/auth/v1/logout')) return json({});
      if (url.includes('/auth/v1/user')) return deleted ? json({ code: 'user_not_found', message: 'Deleted' }, 401) : json(user());
      if (url.includes('/rest/v1/rpc/save_progress_snapshot')) {
        if (failUpload) return json({ code: '42501', message: 'Test upload failure' }, 403);
        uploads++; return json({ revision: 1, records: request.postDataJSON().p_records, updated_at: new Date().toISOString(), conflict: false });
      }
      if (url.includes('/rest/v1/progress_sync_snapshots')) return json(null);
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(`${base}/account/`);
    await page.evaluate(value => {
      localStorage.setItem('coptic-progress', value);
      localStorage.setItem('coptic-progress-recovery:v1', 'recovery preserved');
    }, progress);
    await page.getByLabel('Email', { exact: true }).fill('disposable@example.test');
    await page.getByLabel('Password', { exact: true }).fill('password-for-test');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/settings/');
    await page.goto(`${base}/account/`);
    const entry = page.getByRole('button', { name: 'Delete Account', exact: true });
    if (scenario === 'unavailable') {
      await page.getByText('Account deletion is currently unavailable.', { exact: false }).waitFor();
      assert.equal(await entry.isDisabled(), true); assert.equal(requests, 0);
      await context.close(); continue;
    }
    await entry.click();
    const final = page.getByRole('button', { name: 'Permanently Delete Account', exact: true });
    assert.equal(await final.isDisabled(), true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(requests, 0);
    await entry.click();
    await page.getByLabel('Current password', { exact: true }).fill('password-for-test');
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    if (scenario === 'success') {
      await context.setOffline(true);
      await final.click();
      await page.getByText('You are offline.', { exact: false }).waitFor();
      assert.equal(requests, 0, 'offline confirmation never sends deletion');
      await context.setOffline(false);
      await page.getByLabel('Current password', { exact: true }).fill('password-for-test');
      await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    }
    await final.evaluate(button => { button.click(); button.click(); });
    if (scenario === 'lost-response') {
      await page.getByRole('button', { name: 'Check deletion status' }).waitFor();
      assert.ok(await page.evaluate(() => localStorage.getItem('coptic-account-deletion-pending:v1')));
      // A restart resolves the receipt, without sending another destructive request.
      await page.reload();
    } else {
      await page.getByText('Your account and its cloud progress were permanently deleted.', { exact: false }).waitFor();
    }
    await page.getByRole('button', { name: 'Sign In', exact: true }).waitFor();
    assert.equal(requests, 1, 'duplicate taps must send one request');
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('coptic-progress'), localStorage.getItem('coptic-progress-recovery:v1'), localStorage.getItem('coptic-progress-sync-last-user:v1')]), [progress, 'recovery preserved', null]);
    const before = uploads;
    userId = '00000000-0000-4000-8000-0000000000b2'; deleted = false;
    await page.getByLabel('Email', { exact: true }).fill('disposable@example.test');
    await page.getByLabel('Password', { exact: true }).fill('password-for-test');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL('**/settings/');
    await page.goto(`${base}/settings/progress/`);
    await page.getByText('This device contains progress retained from another account.', { exact: false }).waitFor();
    assert.equal(uploads, before, 'new account must not auto-upload retained learning');
    failUpload = true;
    await page.getByRole('button', { name: 'Replace cloud with this device', exact: true }).click();
    await page.getByText('Cloud sync failed (42501)', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('coptic-progress-reuse-consent:v1')), 'required', 'failed transfer cannot authorize another account');
    failUpload = false;
    await page.getByRole('button', { name: 'Sync now', exact: true }).click();
    await page.getByRole('button', { name: 'Replace cloud with this device', exact: true }).click();
    await page.getByText('This device’s progress is synced to your account.', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('coptic-progress-reuse-consent:v1'), localStorage.getItem('coptic-progress-sync-last-user:v1')]), [null, userId]);
    await context.close();
  }
  console.log('Account deletion mobile smoke passed: confirmation, cancellation, duplicate taps, durable retry, restart, progress preservation, new-account consent and unavailable backend.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
