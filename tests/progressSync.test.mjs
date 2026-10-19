import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './tsModule.mjs';

const storageModule = await loadTsModule('lib/progressStorage.ts');
const syncModule = await loadTsModule('lib/progressSync.ts');
const { createProgressSyncCoordinator } = await loadTsModule('lib/progressSyncCoordinator.ts');

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  key(index) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

const raw = (xp = 0) => JSON.stringify({ xp, streak: 0, completedLessons: [], lastCompletedDate: null });

test('record comparison ignores object key ordering while retaining exact payload equality', () => {
  assert.equal(syncModule.sameProgressRecords({ a: '1', b: '2' }, { b: '2', a: '1' }), true);
  assert.equal(syncModule.sameProgressRecords({ a: '1' }, { a: '2' }), false);
});

test('sync diagnostics keep useful codes and safe descriptions without exposing server details', () => {
  const message = syncModule.progressSyncErrorMessage({
    code: '42702',
    message: 'column reference "revision" is ambiguous; passage=PRIVATE-TEXT',
    details: 'token=PRIVATE-TOKEN email=learner@example.invalid',
  });
  assert.match(message, /42702/u);
  assert.match(message, /ambiguous database column/u);
  assert.doesNotMatch(message, /PRIVATE|learner@example|token=/u);

  const unknown = syncModule.progressSyncErrorMessage({ code: 'PGRST202', message: 'sensitive payload detail' });
  assert.match(unknown, /PGRST202/u);
  assert.match(unknown, /schema cache/u);
  assert.doesNotMatch(unknown, /sensitive payload/u);
});

test('removing prior learning progress is treated as a destructive change', () => {
  assert.equal(syncModule.removesProgressRecords({ 'coptic-progress': raw(20) }, {}), true);
  assert.equal(syncModule.removesProgressRecords({ 'coptic-progress': raw(20) }, { 'coptic-progress': raw(10) }), true);
  assert.equal(syncModule.removesProgressRecords({ 'coptic-progress': raw(20) }, { 'coptic-progress': raw(30) }), false);
});

test('cloud restore keeps the Phase 1 recovery file and writes an independent pre-sync recovery copy', () => {
  const storage = new MemoryStorage();
  const oldRecords = { 'coptic-progress': raw(41) };
  storage.setItem('coptic-progress', oldRecords['coptic-progress']);
  const priorRecovery = JSON.stringify({ version: 1, savedAt: 'prior', records: { 'coptic-progress': raw(12) } });
  storage.setItem(storageModule.RECOVERY_KEY, priorRecovery);

  storageModule.replaceRecordsForCloudSync({ 'coptic-progress': raw(80) }, storage);

  assert.equal(storage.getItem(storageModule.RECOVERY_KEY), priorRecovery);
  const cloudRecovery = JSON.parse(storageModule.recoveryFile(storage, storageModule.CLOUD_SYNC_RECOVERY_KEY));
  assert.equal(cloudRecovery.records['coptic-progress'], raw(41));
  assert.equal(storage.getItem('coptic-progress'), raw(80));
});

test('pre-sync recovery can be restored and first saves the current progress in Phase 1 recovery', () => {
  const storage = new MemoryStorage();
  storage.setItem('coptic-progress', raw(80));
  const preSync = JSON.stringify({ version: 1, savedAt: 'before-cloud', records: { 'coptic-progress': raw(41) } });
  storage.setItem(storageModule.CLOUD_SYNC_RECOVERY_KEY, preSync);
  storageModule.undoCloudSync(storage);
  assert.equal(storage.getItem('coptic-progress'), raw(41));
  assert.equal(JSON.parse(storageModule.recoveryFile(storage)).records['coptic-progress'], raw(80));
  assert.equal(storage.getItem(storageModule.CLOUD_SYNC_RECOVERY_KEY), preSync);
});

test('failed cloud restore does not write the new local snapshot or replace prior recovery', () => {
  const storage = new MemoryStorage();
  const oldRaw = raw(2);
  storage.setItem('coptic-progress', oldRaw);
  const priorRecovery = JSON.stringify({ version: 1, savedAt: 'prior', records: {} });
  storage.setItem(storageModule.RECOVERY_KEY, priorRecovery);
  storage.setItem(storageModule.CLOUD_SYNC_RECOVERY_KEY, 'old-cloud-recovery');
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === 'coptic-progress-transaction:v1') throw new Error('simulated journal write failure');
    setItem(key, value);
  };

  assert.throws(() => storageModule.replaceRecordsForCloudSync({ 'coptic-progress': raw(99) }, storage), /simulated journal write failure/);
  assert.equal(storage.getItem('coptic-progress'), oldRaw);
  assert.equal(storage.getItem(storageModule.RECOVERY_KEY), priorRecovery);
  assert.equal(storage.getItem(storageModule.CLOUD_SYNC_RECOVERY_KEY), 'old-cloud-recovery');
});

test('RPC conflict remains a conflict and forwards cancellation without accepting a stale revision', async () => {
  const controller = new AbortController();
  let request;
  const client = {
    rpc(name, args) {
      request = { name, args, signal: null };
      return {
        abortSignal(signal) { request.signal = signal; return this; },
        then(resolve, reject) {
          return Promise.resolve({ data: [{ revision: 7, records: { 'coptic-progress': raw(12) }, updated_at: null, conflict: true }], error: null }).then(resolve, reject);
        },
      };
    },
  };
  const result = await syncModule.writeProgressSnapshot(client, 6, { 'coptic-progress': raw(10) }, controller.signal);
  assert.equal(request.name, 'save_progress_snapshot');
  assert.equal(request.args.p_expected_revision, 6);
  assert.equal(request.signal, controller.signal);
  assert.deepEqual(result, { conflict: true, snapshot: { revision: 7, records: { 'coptic-progress': raw(12) }, updatedAt: null } });
});

test('invalid cloud records are rejected before an RPC is sent', async () => {
  let called = false;
  const client = { rpc() { called = true; throw new Error('must not send invalid records'); } };
  await assert.rejects(syncModule.writeProgressSnapshot(client, 0, { 'coptic-progress': '{bad-json' }));
  assert.equal(called, false);
});

test('RPC accepts app-valid fractional totals and large individual learning records', async () => {
  const records = {
    'coptic-progress': JSON.stringify({ xp: 12.5, streak: 1.5, completedLessons: [], lastCompletedDate: null }),
    'coptic-learning:v1': JSON.stringify({ version: 1, skills: {
      skill: { word: 'ⲙⲁ', meaning: 'bread', attempts: 2, correct: 1, lapses: 1, dueAt: 1700000000000,
        lastSeen: 1700000000000, successfulDays: 1, explanation: 'x'.repeat(1_048_600) },
    } }),
  };
  let request;
  const client = {
    rpc(name, args) {
      request = { name, args };
      return Promise.resolve({ data: [{ revision: 1, records: args.p_records, updated_at: null, conflict: false }], error: null });
    },
  };
  const result = await syncModule.writeProgressSnapshot(client, 0, records);
  assert.equal(request.name, 'save_progress_snapshot');
  assert.equal(JSON.parse(request.args.p_records['coptic-progress']).xp, 12.5);
  assert.ok(request.args.p_records['coptic-learning:v1'].length > 1_048_576);
  assert.equal(result.revision, 1);
});

test('malformed cloud snapshots and unsafe revisions are rejected before reconciliation', async () => {
  let row = { revision: 1, records: { 'unsupported-key': '[]' }, updated_at: null };
  const client = {
    from() {
      const query = {
        select() { return this; },
        eq() { return this; },
        abortSignal() { return this; },
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return query;
    },
  };
  await assert.rejects(syncModule.fetchProgressSnapshot(client, 'user-a'));
  row = { revision: Number.MAX_SAFE_INTEGER + 1, records: {}, updated_at: null };
  await assert.rejects(syncModule.fetchProgressSnapshot(client, 'user-a'), /revision is invalid/);
});

function coordinatorFixture(options = {}) {
  const base = options.base ?? { revision: 1, records: { 'coptic-progress': raw(1) } };
  const state = {
    user: options.user === undefined ? 'user-a' : options.user,
    enabled: options.enabled !== false,
    lastUser: options.lastUser === undefined ? 'user-a' : options.lastUser,
    local: options.local ?? base.records,
    cloud: options.cloud === undefined ? { revision: 1, records: base.records, updatedAt: null } : options.cloud,
    base: structuredClone(base),
    calls: { cloud: 0, upload: 0, install: 0, saveBase: 0 },
  };
  const adapter = {
    currentUser: async () => state.user,
    isEnabled: id => state.enabled && state.user === id,
    lastUser: () => state.lastUser,
    base: () => state.base,
    local: () => state.local,
    cloud: async () => { state.calls.cloud++; return state.cloud; },
    upload: async (revision, records) => {
      state.calls.upload++;
      if (revision !== state.cloud?.revision) return { conflict: true, snapshot: state.cloud };
      state.cloud = { revision: revision + 1, records: structuredClone(records), updatedAt: null };
      return state.cloud;
    },
    install(records) { state.calls.install++; state.local = structuredClone(records); },
    saveBase(id, revision, records) { state.calls.saveBase++; state.base = { revision, records: structuredClone(records) }; },
    rememberUser(id) { state.lastUser = id; },
  };
  return { state, coordinator: createProgressSyncCoordinator(adapter), adapter };
}

test('first sync stays pending for explicit review; empty local and cloud do not create progress', async () => {
  const empty = { revision: 1, records: {}, updatedAt: null };
  const firstLocal = coordinatorFixture({ base: null, cloud: null, local: { 'coptic-progress': raw(3) } });
  await firstLocal.coordinator.request();
  assert.equal(firstLocal.state.calls.upload, 0);
  assert.equal(firstLocal.state.calls.install, 0);

  const firstCloud = coordinatorFixture({ base: null, cloud: { revision: 2, records: { 'coptic-progress': raw(9) }, updatedAt: null }, local: {} });
  await firstCloud.coordinator.request();
  assert.equal(firstCloud.state.calls.install, 0);

  const noData = coordinatorFixture({ base: { revision: 1, records: {} }, cloud: empty, local: {} });
  await noData.coordinator.request();
  assert.equal(noData.state.calls.upload, 0);
  assert.equal(noData.state.calls.install, 0);
});

test('local-only progress uploads by compare-and-swap and retains exact Unicode/schedule records', async () => {
  const records = {
    'coptic-progress': raw(33),
    'coptic-unit-progress:lesson-1': JSON.stringify(['ⲁⲃ', 'ⲙ̄ⲛ']),
    'coptic-vocabulary:v1': JSON.stringify({ version: 1, cards: [{ id: 'ⲙⲁ', word: 'ⲙⲁ', meaning: 'word', createdAt: 1700000000, dueAt: 1700000000, intervalDays: 3, reviews: 2, lapses: 1, streak: 2, lastReviewedAt: null }] }),
  };
  const fixture = coordinatorFixture({ local: records });
  await fixture.coordinator.request();
  assert.equal(fixture.state.calls.upload, 1);
  assert.deepEqual(fixture.state.cloud.records, records);
  assert.deepEqual(fixture.state.base.records, records);
  assert.equal(fixture.state.base.revision, 2);
});

test('cloud-only changes install only after the fresh read and local comparison', async () => {
  const next = { 'coptic-progress': raw(25), 'coptic-unit-progress:lesson-1': JSON.stringify(['ⲁ']) };
  const fixture = coordinatorFixture({ cloud: { revision: 2, records: next, updatedAt: null } });
  await fixture.coordinator.request();
  assert.equal(fixture.state.calls.cloud, 2);
  assert.equal(fixture.state.calls.install, 1);
  assert.deepEqual(fixture.state.local, next);
  assert.deepEqual(fixture.state.base.records, next);
  assert.equal(fixture.state.base.revision, 2);
});

test('two-sided edits and concurrent cloud revisions are not overwritten', async () => {
  const fixture = coordinatorFixture({
    local: { 'coptic-progress': raw(4) },
    cloud: { revision: 2, records: { 'coptic-progress': raw(7) }, updatedAt: null },
  });
  await fixture.coordinator.request();
  assert.equal(fixture.state.calls.upload, 0);
  assert.equal(fixture.state.calls.install, 0);

  const raced = coordinatorFixture({ local: { 'coptic-progress': raw(5) } });
  raced.adapter.upload = async () => ({ conflict: true, snapshot: { revision: 9, records: { 'coptic-progress': raw(50) }, updatedAt: null } });
  const oldBase = structuredClone(raced.state.base);
  await raced.coordinator.request();
  assert.deepEqual(raced.state.base, oldBase);
  assert.equal(raced.state.local['coptic-progress'], raw(5));
});

test('offline/interrupted operations preserve local progress and baseline, and reconnect can retry', async () => {
  const fixture = coordinatorFixture({ local: { 'coptic-progress': raw(8) } });
  fixture.adapter.cloud = async () => { fixture.state.calls.cloud++; throw new Error('offline'); };
  const oldBase = structuredClone(fixture.state.base);
  await assert.rejects(fixture.coordinator.request(), /offline/);
  assert.deepEqual(fixture.state.base, oldBase);
  assert.equal(fixture.state.local['coptic-progress'], raw(8));
  fixture.adapter.cloud = async () => { fixture.state.calls.cloud++; return fixture.state.cloud; };
  await fixture.coordinator.request();
  assert.equal(fixture.state.calls.upload, 1);
});

test('failed journaled cloud install does not advance the base', async () => {
  const fixture = coordinatorFixture({ cloud: { revision: 2, records: { 'coptic-progress': raw(90) }, updatedAt: null } });
  fixture.adapter.install = () => { throw new Error('recovery journal failed'); };
  const oldBase = structuredClone(fixture.state.base);
  await assert.rejects(fixture.coordinator.request(), /recovery journal failed/);
  assert.deepEqual(fixture.state.base, oldBase);
  assert.equal(fixture.state.local['coptic-progress'], raw(1));
});

test('account switch/sign-out and local restore during requests stop stale completion', async () => {
  const fixture = coordinatorFixture({ cloud: { revision: 2, records: { 'coptic-progress': raw(99) }, updatedAt: null } });
  const originalCloud = fixture.adapter.cloud;
  fixture.adapter.cloud = async (...args) => {
    const snapshot = await originalCloud(...args);
    fixture.state.user = null;
    return snapshot;
  };
  await fixture.coordinator.request();
  assert.equal(fixture.state.calls.install, 0);
  assert.equal(fixture.state.calls.saveBase, 0);

  const accountSwitch = coordinatorFixture({ user: 'user-b', lastUser: 'user-a', cloud: { revision: 2, records: { 'coptic-progress': raw(20) }, updatedAt: null } });
  await accountSwitch.coordinator.request();
  assert.equal(accountSwitch.state.calls.cloud, 0);
});

test('backup import during cloud refresh and a cloud revision race both stop installation', async () => {
  const backupImport = coordinatorFixture({ cloud: { revision: 2, records: { 'coptic-progress': raw(30) }, updatedAt: null } });
  const cloudRead = backupImport.adapter.cloud;
  backupImport.adapter.cloud = async (...args) => {
    const result = await cloudRead(...args);
    if (backupImport.state.calls.cloud === 2) backupImport.state.local = { 'coptic-progress': raw(15) };
    return result;
  };
  await backupImport.coordinator.request();
  assert.equal(backupImport.state.calls.install, 0);
  assert.equal(backupImport.state.local['coptic-progress'], raw(15));
  assert.equal(backupImport.state.base.revision, 1);

  const cloudRace = coordinatorFixture({ cloud: { revision: 2, records: { 'coptic-progress': raw(30) }, updatedAt: null } });
  const initialRead = cloudRace.adapter.cloud;
  cloudRace.adapter.cloud = async (...args) => {
    await initialRead(...args);
    if (cloudRace.state.calls.cloud === 2) {
      cloudRace.state.cloud = { revision: 3, records: { 'coptic-progress': raw(50) }, updatedAt: null };
      return cloudRace.state.cloud;
    }
    return cloudRace.state.cloud;
  };
  await cloudRace.coordinator.request();
  assert.equal(cloudRace.state.calls.install, 0);
  assert.equal(cloudRace.state.base.revision, 1);
});

test('duplicate sync triggers are single-flight and a local edit during upload remains pending', async () => {
  const fixture = coordinatorFixture({ local: { 'coptic-progress': raw(2) } });
  let release;
  fixture.adapter.cloud = async () => {
    fixture.state.calls.cloud++;
    if (fixture.state.calls.cloud === 1) await new Promise(resolve => { release = resolve; });
    return fixture.state.cloud;
  };
  const first = fixture.coordinator.request();
  const second = fixture.coordinator.request();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  release();
  await Promise.all([first, second]);
  assert.equal(fixture.state.calls.cloud, 1); // both lifecycle triggers shared the active reconciliation
  assert.equal(fixture.state.calls.upload, 1);

  const changed = coordinatorFixture({ local: { 'coptic-progress': raw(3) } });
  const originalUpload = changed.adapter.upload;
  changed.adapter.upload = async (...args) => {
    const uploaded = await originalUpload(...args);
    changed.state.local = { 'coptic-progress': raw(4) };
    return uploaded;
  };
  await changed.coordinator.request();
  assert.equal(changed.state.base.records['coptic-progress'], raw(4));
  assert.equal(changed.state.cloud.records['coptic-progress'], raw(4));
  assert.equal(changed.state.local['coptic-progress'], raw(4));
});
