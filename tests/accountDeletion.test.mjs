import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './tsModule.mjs';

const { createDeletionHandler } = await loadTsModule('supabase/functions/account-deletion/handler.ts');
const { createDeletionState, deletionAwareAuthStorage, deletionSyncBlocked, PROGRESS_REUSE_CONSENT_KEY } = await loadTsModule('lib/auth/deletionState.ts');
const receipt = 'ab'.repeat(32);

function fixture(overrides = {}) {
  const calls = []; let row = null; let objects = [{ bucket_id: 'uploads', name: 'nested/private.txt' }];
  const backend = {
    ready: async () => true,
    verify: async token => token === 'user-a-token' ? { id: 'user-a', email: 'a@example.test' } : null,
    verifyPassword: async (email, password) => password === 'correct' && email === 'a@example.test' ? 'user-a' : null,
    receipt: async () => row,
    claim: async (id, hash) => { calls.push(['claim', id, hash]); if (row) return false; row = { user_id: id, locked_until: new Date(Date.now() + 120000).toISOString() }; return true; },
    objects: async id => { calls.push(['objects', id]); return objects; },
    removeObjects: async (bucket, paths) => { calls.push(['remove', bucket, paths]); objects = []; },
    deleteUser: async id => { calls.push(['delete', id]); row.user_id = null; },
    ...overrides,
  };
  const handler = createDeletionHandler(backend, ['capacitor://localhost']);
  async function request(body = {}, token = 'user-a-token', origin = 'capacitor://localhost') {
    const response = await handler(new Request('https://isolated.test/account-deletion', {
      method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: origin },
      body: JSON.stringify({ action: 'delete', receipt, password: 'correct', confirmation: 'DELETE', ...body }),
    }));
    return { status: response.status, ...await response.json() };
  }
  return { handler, request, calls, backend };
}

test('hard deletion cleans owned objects first, verifies receipt, and status survives loss of authentication', async () => {
  const f = fixture();
  assert.deepEqual(await f.request(), { status: 200, state: 'deleted' });
  assert.deepEqual(f.calls.filter(c => c[0] === 'delete'), [['delete', 'user-a']]);
  assert.ok(f.calls.findIndex(c => c[0] === 'remove') < f.calls.findIndex(c => c[0] === 'delete'));
  assert.notEqual(f.calls[0][2], receipt, 'only the hash is stored');
  assert.deepEqual(await f.request({ action: 'status' }, null), { status: 200, state: 'deleted' });
});

for (const token of [null, 'expired-token', 'forged-token']) test(`rejects ${token ?? 'missing'} authentication without privileged changes`, async () => {
  const f = fixture();
  assert.equal((await f.request({}, token)).status, 401);
  assert.deepEqual(f.calls, []);
});

test('REGRESSION: signed-in user A cannot administratively delete user B through a supplied target', async () => {
  for (const key of ['userId', 'user_id', 'id', 'target']) {
    const f = fixture();
    assert.equal((await f.request({ [key]: 'user-b' })).status, 400);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture({ receipt: async () => ({ user_id: 'user-b', locked_until: '' }) });
  assert.equal((await f.request()).status, 403);
  assert.deepEqual(f.calls, []);
});

test('fresh password verification must return the same identity as the verified bearer token', async () => {
  for (const verifyPassword of [async () => null, async () => 'user-b']) {
    const f = fixture({ verifyPassword });
    assert.equal((await f.request()).state, 'verification_failed');
    assert.deepEqual(f.calls, []);
  }
});

test('text confirmation alone cannot delete an account', async () => {
  const f = fixture();
  assert.equal((await f.request({ password: '' })).status, 400);
  assert.equal((await f.request({ confirmation: 'delete' })).status, 400);
  assert.deepEqual(f.calls, []);
});

test('replayed completed requests cannot delete again', async () => {
  const f = fixture(); await f.request();
  assert.equal((await f.request()).status, 403);
  assert.equal(f.calls.filter(c => c[0] === 'delete').length, 1);
});

test('duplicate requests share a server lease and only one deletion executes', async () => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const f = fixture({ objects: async () => { await hold; return []; } });
  const first = f.request();
  while (!f.calls.length) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal((await f.request()).state, 'processing');
  release(); assert.equal((await first).state, 'deleted');
  assert.equal(f.calls.filter(c => c[0] === 'delete').length, 1);
});

for (const operation of ['objects', 'removeObjects', 'deleteUser']) test(`${operation} network/dependency failure is retryable and never reports success`, async () => {
  const f = fixture({ [operation]: async () => { throw new Error('private backend information'); } });
  assert.deepEqual(await f.request(), { status: 503, state: 'retry' });
  assert.equal((await f.request({ action: 'status' }, null)).state, 'processing');
  if (operation !== 'deleteUser') assert.equal(f.calls.filter(c => c[0] === 'delete').length, 0);
});

test('lost deletion response is recovered from the durable FK receipt', async () => {
  const f = fixture();
  const remove = f.backend.deleteUser;
  f.backend.deleteUser = async id => { await remove(id); throw new Error('timeout after commit'); };
  assert.equal((await f.request()).state, 'retry');
  assert.equal((await f.request({ action: 'status' }, null)).state, 'deleted');
});

test('missing backend configuration fails closed; receipt-only requests cannot delete', async () => {
  const f = fixture({ ready: async () => false });
  assert.deepEqual(await f.request({ action: 'ready' }), { status: 503, state: 'unavailable' });
  assert.equal((await f.request()).status, 503);
  assert.deepEqual(f.calls, []);
});

test('CORS is restricted to configured Capacitor/web origins', async () => {
  const f = fixture();
  assert.equal((await f.request({}, 'user-a-token', 'https://attacker.test')).status, 403);
  const response = await f.handler(new Request('https://isolated.test', { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost' } }));
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
  assert.equal(response.status, 204);
});

function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('deletion preserves learning, preferences, recovery and transaction journals; clears only sync identity', async () => {
  const secure = storage(), local = storage();
  const preserved = ['coptic-progress', 'coptic-learning:v1', 'coptic-vocabulary:v1', 'coptic-reader:v1', 'coptic-unit-progress:a', 'coptic-progress-recovery:v1', 'coptic-progress-cloud-recovery:v1', 'coptic-progress-transaction:v1', 'coptic-theme'];
  for (const key of preserved) local.setItem(key, 'original bytes');
  for (const key of ['coptic-progress-sync-base:v1:user-a', 'coptic-progress-sync-last-user:v1', 'coptic-progress-sync-enabled:v1']) local.setItem(key, 'user-a');
  const state = createDeletionState(secure, local);
  const pending = await state.begin('user-a');
  assert.ok(deletionSyncBlocked(local));
  assert.deepEqual(await createDeletionState(secure, local).read(), pending, 'receipt survives restart');
  await state.revoke('user-a'); await state.finish('user-a');
  for (const key of preserved) assert.equal(local.getItem(key), 'original bytes');
  assert.equal(local.getItem('coptic-progress-sync-last-user:v1'), null);
  assert.equal(local.getItem('coptic-progress-sync-base:v1:user-a'), null);
  assert.equal(local.getItem(PROGRESS_REUSE_CONSENT_KEY), 'required', 'new account cannot automatically upload retained records');
  assert.equal(await state.read(), null);
  assert.equal(await createDeletionState(secure, local).allows('user-a'), false);
  assert.equal(await state.allows('user-b'), true);
  assert.ok(!JSON.stringify([...secure.data]).includes('user-a'), 'raw old account UUID is removed');
});

test('late session writes and cached restored credentials cannot reconnect a deleted account', async () => {
  const secure = storage(), local = storage();
  const state = createDeletionState(secure, local);
  const guarded = deletionAwareAuthStorage(secure, state);
  const key = 'sb-test-auth-token'; const old = JSON.stringify({ user: { id: 'user-a' }, access_token: 'old' });
  await guarded.setItem(key, old); await state.revoke('user-a');
  assert.equal(await guarded.getItem(key), null);
  await guarded.setItem(key, old); assert.equal(secure.getItem(key), null);
  const next = JSON.stringify({ user: { id: 'user-b' } });
  await guarded.setItem(key, next); assert.equal(await guarded.getItem(key), next);
});
