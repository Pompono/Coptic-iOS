// DESTRUCTIVE TEST: hard allowlist for the disposable local Supabase stack only.
import assert from 'node:assert/strict';
const url = process.env.API_URL;
if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(url)) throw new Error('Refusing non-local integration target');
const anon = process.env.ANON_KEY, admin = process.env.SERVICE_ROLE_KEY;
if (!anon || !admin) throw new Error('Local test credentials required');
const password = 'Disposable-test-password-73!';
async function request(route, { token = admin, method = 'GET', body, raw } = {}) {
  const response = await fetch(url + route, { method, headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: raw ?? (body ? JSON.stringify(body) : undefined), signal: AbortSignal.timeout(30000) });
  const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}
const accounts = [];
try {
  for (const letter of ['a', 'b']) {
    const email = `deletion-${letter}-${Date.now()}@example.test`;
    const created = await request('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } });
    assert.equal(created.status, 200); accounts.push(created.data.id);
    const signed = await request('/auth/v1/token?grant_type=password', { method: 'POST', token: anon, body: { email, password } });
    assert.equal(signed.status, 200);
    if (letter === 'a') accounts.token = signed.data.access_token;
  }
  const [a, b] = accounts;
  const receipt = 'cd'.repeat(32);
  const endpoint = '/functions/v1/account-deletion';
  assert.equal((await request(endpoint, { method: 'POST', body: { action: 'ready' } })).data.state, 'available');
  assert.equal((await request('/rest/v1/rpc/save_progress_snapshot', { method: 'POST', token: accounts.token, body: { p_expected_revision: 0, p_records: { 'coptic-progress': JSON.stringify({ xp: 9, streak: 0, completedLessons: [], lastCompletedDate: null }) } } })).status, 200);
  const bucket = `deletion-test-${Date.now()}`;
  assert.equal((await request('/storage/v1/bucket', { method: 'POST', body: { id: bucket, name: bucket } })).status, 200);
  assert.equal((await request(`/storage/v1/object/${bucket}/nested/example.json`, { method: 'POST', token: accounts.token, raw: '{"test":true}' })).status, 200);
  const deletion = { action: 'delete', receipt, password, confirmation: 'DELETE' };
  assert.equal((await request(endpoint, { method: 'POST', token: accounts.token, body: { ...deletion, userId: b } })).status, 400);
  assert.equal((await request(endpoint, { method: 'POST', token: anon, body: deletion })).status, 401);
  assert.equal((await request(endpoint, { method: 'POST', token: accounts.token, body: { ...deletion, password: 'wrong' } })).status, 403);
  assert.equal((await request(endpoint, { method: 'POST', token: accounts.token, body: deletion })).data.state, 'deleted');
  assert.equal((await request(endpoint, { method: 'POST', token: anon, body: { action: 'status', receipt } })).data.state, 'deleted');
  assert.equal((await request(`/auth/v1/admin/users/${a}`)).status, 404);
  assert.equal((await request(`/auth/v1/admin/users/${b}`)).status, 200);
  assert.deepEqual((await request(`/rest/v1/progress_sync_snapshots?user_id=eq.${a}`)).data, []);
  assert.deepEqual((await request('/rest/v1/rpc/account_deletion_objects', { method: 'POST', body: { p_user_id: a } })).data, []);
  assert.ok((await request('/rest/v1/rpc/save_progress_snapshot', { method: 'POST', token: accounts.token, body: { p_expected_revision: 0, p_records: {} } })).status >= 400);
  assert.ok((await request(`/storage/v1/object/${bucket}/late.json`, { method: 'POST', token: accounts.token, raw: '{}' })).status >= 400);
  assert.equal((await request(endpoint, { method: 'POST', token: accounts.token, body: deletion })).status, 401);
  await request(`/storage/v1/bucket/${bucket}`, { method: 'DELETE' });
  console.log('Disposable local Supabase integration passed: real password verification, hard Auth deletion, Storage removal, cascade, stale JWT rejection, receipt recovery, other-account isolation.');
} finally {
  for (const id of accounts) await request(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
}
