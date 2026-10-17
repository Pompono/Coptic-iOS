import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './tsModule.mjs';
import { createCard, gradeCard } from '../lib/vocabulary/schedule.mjs';
import { recordAttempt } from '../lib/learning/progress.mjs';
const { makeBackup, parseBackup, restoreBackup, readRecord, writeRecord, recoverPending, undoRestore, RECOVERY_KEY, inspectCurrentProgress, parseBackupBytes } = await loadTsModule('lib/progressStorage.ts');
class MemoryStorage {
  data = new Map();
  fail = () => false;
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(key) { if (this.fail('get', key)) throw Error('storage denied'); return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail('set', key)) throw Error('quota exceeded'); this.data.set(key, String(value)); }
  removeItem(key) { if (this.fail('remove', key)) throw Error('storage denied'); this.data.delete(key); }
}
const oldProgress = { xp: 245, streak: 3, lastCompletedDate: '2026-10-17', completedLessons: ['lesson-one'] };
function fixture() {
  const storage = new MemoryStorage();
  const word = 'ⲡⲓⲱ\u0305ⲓⲕ\u0301';
  storage.setItem('coptic-progress', JSON.stringify(oldProgress));
  storage.setItem('coptic-unit-progress:legacy-id', '["old-step","unknown-step"]');
  storage.setItem('coptic-unit-failed-steps:legacy-id', '["retry"]');
  storage.setItem('coptic-vocabulary:v1', JSON.stringify({ version: 1, cards: [gradeCard(createCard({ word, meaning: 'bread', context: word }, 1000), 'hard', 2000)] }));
  storage.setItem('coptic-learning:v1', JSON.stringify(recordAttempt({ version: 1, skills: {} }, { word, meaning: 'bread', unitId: 'legacy-id' }, true, true, 1000)));
  storage.setItem('coptic-reader:v1', JSON.stringify({ version: 1, passageId: 'custom', draft: word }));
  storage.setItem('auth-token', 'secret');
  storage.setItem('coptic-dictionary-recent', '["private search"]');
  return storage;
}
test('existing and legacy records load without migration; unknown course IDs retained', () => {
  const storage = fixture();
  assert.deepEqual(readRecord('coptic-progress', storage), oldProgress);
  assert.deepEqual(readRecord('coptic-unit-progress:legacy-id', storage), ['old-step', 'unknown-step']);
});
test('empty and missing progress are distinct from malformed data', () => {
  const storage = new MemoryStorage();
  assert.equal(readRecord('coptic-progress', storage), null);
  assert.deepEqual(makeBackup(storage).records, {});
  storage.setItem('coptic-progress', '');
  assert.throws(() => readRecord('coptic-progress', storage));
  assert.throws(() => makeBackup(storage));
  assert.equal(storage.getItem('coptic-progress'), '');
});
test('corrupt, unsupported and mixed unit arrays cannot be overwritten by writes', () => {
  for (const [key, raw, next] of [
    ['coptic-progress', '{bad', oldProgress],
    ['coptic-unit-progress:x', '["one",2]', ['two']],
    ['coptic-learning:v1', '{"version":2,"skills":{}}', { version: 1, skills: {} }],
    ['coptic-vocabulary:v1', '{"version":2,"cards":[]}', { version: 1, cards: [] }],
    ['coptic-reader:v1', '{"version":2,"draft":"old"}', { version: 1, passageId: 'custom', draft: 'new' }],
  ]) {
    const storage = new MemoryStorage(); storage.setItem(key, raw);
    assert.throws(() => writeRecord(key, next, storage));
    assert.equal(storage.getItem(key), raw);
  }
});
test('invalid new records and storage access failures are reported without resetting data', () => {
  const storage = fixture(); const before = [...storage.data];
  assert.throws(() => writeRecord('coptic-progress', { ...oldProgress, xp: NaN }, storage));
  storage.fail = () => true;
  assert.throws(() => readRecord('coptic-progress', storage));
  assert.throws(() => makeBackup(storage));
  assert.throws(() => restoreBackup(makeBackup(new MemoryStorage()), true, storage));
  assert.deepEqual([...storage.data], before);
});
test('backup round trip preserves exact raw bytes, Unicode combining marks, schedules, mastery and totals; excludes unrelated storage', () => {
  const source = fixture(); const backup = parseBackup(JSON.stringify(makeBackup(source)));
  assert.equal(backup.records['auth-token'], undefined);
  assert.equal(backup.records['coptic-dictionary-recent'], undefined);
  const target = new MemoryStorage();
  restoreBackup(backup, true, target);
  assert.deepEqual(makeBackup(target).records, backup.records);
  const card = JSON.parse(backup.records['coptic-vocabulary:v1']).cards[0];
  assert.equal(card.word, 'ⲡⲓⲱ\u0305ⲓⲕ\u0301');
  assert.equal(card.dueAt, 86402000);
  assert.equal(card.reviews, 1);
});
test('unsupported, malformed and unrelated backup records rejected without changing existing progress', () => {
  const storage = fixture(); const before = [...storage.data];
  for (const data of [ { ...makeBackup(storage), version: 2 }, { ...makeBackup(storage), records: { 'auth-token': 'secret' } }, { ...makeBackup(storage), records: { 'coptic-progress': '{}' } } ]) {
    assert.throws(() => restoreBackup(data, true, storage));
    assert.deepEqual([...storage.data], before);
  }
  assert.throws(() => parseBackup('{'));
});
test('confirmation is required; cancellation has no storage effects; confirmed replace retains recovery copy', () => {
  const storage = fixture(); const before = [...storage.data];
  const empty = makeBackup(new MemoryStorage());
  assert.equal(restoreBackup(empty, false, storage), false);
  assert.deepEqual([...storage.data], before);
  assert.equal(restoreBackup(empty, true, storage), true);
  assert.deepEqual(makeBackup(storage).records, {});
  assert.equal(storage.getItem('auth-token'), 'secret');
  assert.equal(JSON.parse(storage.getItem(RECOVERY_KEY)).records['coptic-progress'], JSON.stringify(oldProgress));
  undoRestore(storage);
  assert.deepEqual(makeBackup(storage).records, makeBackup(fixture()).records);
});
test('recovery save failure prevents any progress modification', () => {
  const storage = fixture(); const before = [...storage.data];
  storage.fail = (op, key) => op === 'set' && key === RECOVERY_KEY;
  assert.throws(() => restoreBackup(makeBackup(new MemoryStorage()), true, storage));
  assert.deepEqual([...storage.data], before);
});
test('partial write failure rolls back all progress', () => {
  const storage = fixture(); const before = makeBackup(storage).records;
  let failed = false;
  storage.fail = (op, key) => { if (!failed && op === 'remove' && key === 'coptic-vocabulary:v1') { failed = true; return true; } return false; };
  assert.throws(() => restoreBackup(makeBackup(new MemoryStorage()), true, storage), /previous progress has been restored/);
  assert.deepEqual(makeBackup(storage).records, before);
});
test('persistent partial failure blocks reads and writes until recovery succeeds after restart', () => {
  const storage = fixture(); const before = makeBackup(storage).records;
  let failed = false;
  storage.fail = (op, key) => {
    if (op === 'remove' && key === 'coptic-vocabulary:v1') failed = true;
    return failed && op !== 'get';
  };
  assert.throws(() => restoreBackup(makeBackup(new MemoryStorage()), true, storage), /Recovery is pending/);
  assert.throws(() => readRecord('coptic-progress', storage));
  assert.throws(() => writeRecord('coptic-unit-progress:x', ['new'], storage));
  storage.fail = () => false;
  recoverPending(storage, Date.now() + 31000);
  assert.deepEqual(makeBackup(storage).records, before);
});
test('restoring over damaged existing records retains their original raw recovery bytes', () => {
  const storage = fixture(); storage.setItem('coptic-progress', 'broken original');
  restoreBackup(makeBackup(new MemoryStorage()), true, storage);
  assert.equal(JSON.parse(storage.getItem(RECOVERY_KEY)).records['coptic-progress'], 'broken original');
  undoRestore(storage);
  assert.equal(storage.getItem('coptic-progress'), 'broken original');
  assert.throws(() => writeRecord('coptic-progress', oldProgress, storage));
});
test('unit mutations refuse corrupt originals even when UI reads cannot show completion', async () => {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage, dispatchEvent() {} };
  const { readCompletedSteps, markStepCompleted, clearStepFailed } = await loadTsModule('app/learn/progress.ts');
  storage.setItem('coptic-unit-progress:x', 'broken');
  assert.equal(readCompletedSteps('x'), null);
  assert.throws(() => markStepCompleted('x', 'one'));
  storage.setItem('coptic-unit-failed-steps:x', 'broken');
  assert.throws(() => clearStepFailed('x', 'one'));
  assert.equal(storage.getItem('coptic-unit-progress:x'), 'broken');
  delete globalThis.window; delete globalThis.localStorage;
});
test('legacy XP and streak calculations remain unchanged', async () => {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage, dispatchEvent() {} };
  const { addXpAndAdvanceStreak, getProgress } = await loadTsModule('lib/progress.ts');
  storage.setItem('coptic-progress', JSON.stringify({ ...oldProgress, lastCompletedDate: '2020-01-01' }));
  addXpAndAdvanceStreak({ lessonId: 'new-lesson', xpEarned: 10 });
  assert.equal(getProgress().xp, 255); assert.equal(getProgress().streak, 4);
  addXpAndAdvanceStreak({ lessonId: 'new-lesson', xpEarned: 10 });
  assert.equal(getProgress().xp, 265); assert.equal(getProgress().streak, 4);
  assert.deepEqual(getProgress().completedLessons, ['lesson-one', 'new-lesson']);
  delete globalThis.window; delete globalThis.localStorage;
});
test('failure during the second imported write rolls back the first write too', () => {
  const storage = fixture(); const before = makeBackup(storage).records;
  const next = makeBackup(fixture());
  next.records['coptic-progress'] = JSON.stringify({ ...oldProgress, xp: 999 });
  next.records['coptic-unit-progress:legacy-id'] = '["different"]';
  let failed = false;
  storage.fail = (op, key) => { if (!failed && op === 'set' && key === 'coptic-unit-progress:legacy-id') { failed = true; return true; } return false; };
  assert.throws(() => restoreBackup(next, true, storage));
  assert.deepEqual(makeBackup(storage).records, before);
});
test('an update/startup reads every legacy record without rewriting any bytes', () => {
  const storage = fixture();
  const deck = JSON.parse(storage.getItem('coptic-vocabulary:v1'));
  for (const field of ['pos', 'dialect', 'context', 'source', 'audio', 'lastReviewedAt']) delete deck.cards[0][field];
  storage.setItem('coptic-vocabulary:v1', JSON.stringify(deck));
  const learning = JSON.parse(storage.getItem('coptic-learning:v1'));
  for (const item of Object.values(learning.skills)) { delete item.unitIds; delete item.needsPractice; delete item.accepted; delete item.lastSuccessfulDay; }
  storage.setItem('coptic-learning:v1', JSON.stringify(learning));
  const before = [...storage.data];
  const backup = makeBackup(storage);
  for (const key of Object.keys(backup.records)) readRecord(key, storage);
  inspectCurrentProgress(storage);
  assert.deepEqual([...storage.data], before);
});
test('two contexts reject stale learning writes instead of overwriting newer progress', () => {
  const first = fixture(), second = new MemoryStorage(); second.data = first.data;
  const a = readRecord('coptic-progress', first), b = readRecord('coptic-progress', second);
  writeRecord('coptic-progress', { ...a, xp: 300 }, first);
  assert.throws(() => writeRecord('coptic-progress', { ...b, xp: 260 }, second), /another window/);
  assert.equal(readRecord('coptic-progress', second).xp, 300);
});
test('a second context cannot roll back a live restore or mutate its records', () => {
  const first = fixture(), second = new MemoryStorage(); second.data = first.data;
  const set = first.setItem.bind(first); let observed = false;
  first.setItem = (key, value) => {
    set(key, value);
    if (key === 'coptic-progress-transaction:v1' && !observed) {
      observed = true;
      assert.throws(() => readRecord('coptic-progress', second), /Wait 30 seconds/);
      assert.throws(() => writeRecord('coptic-unit-progress:x', ['new'], second), /Wait 30 seconds/);
      assert.equal(second.getItem(key), value);
    }
  };
  restoreBackup(makeBackup(new MemoryStorage()), true, first);
  assert.equal(observed, true);
  assert.deepEqual(makeBackup(first).records, {});
});
test('interrupted restoration waits for the live lease, then recovers every raw record', () => {
  const storage = fixture(), before = makeBackup(storage).records;
  const set = storage.setItem.bind(storage); let journal;
  storage.setItem = (key, value) => { set(key, value); if (key === 'coptic-progress-transaction:v1') journal = value; };
  restoreBackup(makeBackup(new MemoryStorage()), true, storage);
  // A newly created storage facade represents a new app process after termination.
  const reloaded = new MemoryStorage(); reloaded.data = storage.data;
  reloaded.setItem('coptic-progress-transaction:v1', journal);
  assert.throws(() => makeBackup(reloaded), /Wait 30 seconds/);
  assert.deepEqual(Object.keys(reloaded.data).filter(key => key === 'coptic-progress'), []);
  recoverPending(reloaded, Date.now() + 31000);
  assert.deepEqual(makeBackup(reloaded).records, before);
});
test('damaged or unsupported journals are preserved; explicit recovery can quarantine them safely', () => {
  for (const journal of ['{broken', '{"version":99,"records":{}}', '{"version":1,"records":{"auth-token":"x"}}']) {
    const storage = fixture(); const before = makeBackup(storage).records;
    restoreBackup(makeBackup(new MemoryStorage()), true, storage);
    storage.setItem('coptic-progress-transaction:v1', journal);
    assert.throws(() => readRecord('coptic-progress', storage), /journal is damaged/);
    assert.throws(() => restoreBackup(makeBackup(fixture()), true, storage));
    assert.equal(storage.getItem('coptic-progress-transaction:v1'), journal);
    undoRestore(storage);
    assert.equal(storage.getItem('coptic-progress-damaged-journal:v1'), journal);
    assert.deepEqual(makeBackup(storage).records, before);
  }
});
test('journal checksum rejects a syntactically valid but accidentally emptied snapshot', () => {
  const storage = fixture(); let raw; const set = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { set(key, value); if (key === 'coptic-progress-transaction:v1') raw = value; };
  restoreBackup(makeBackup(new MemoryStorage()), true, storage);
  const damaged = JSON.parse(raw); damaged.records = {}; damaged.activeUntil = 0;
  storage.setItem('coptic-progress-transaction:v1', JSON.stringify(damaged));
  assert.throws(() => recoverPending(storage), /journal is damaged/);
  undoRestore(storage);
  assert.equal(readRecord('coptic-progress', storage).xp, oldProgress.xp);
});
test('repeated imports, empty backup and immediate export retain the exact latest restored state', () => {
  const storage = fixture(); const first = makeBackup(fixture()), empty = makeBackup(new MemoryStorage());
  for (const backup of [first, first, empty, first]) {
    restoreBackup(backup, true, storage);
    assert.deepEqual(parseBackup(JSON.stringify(makeBackup(storage))).records, backup.records);
  }
});
test('stale replacement confirmation is rejected; damaged current progress can still be summarized without loss', () => {
  const storage = fixture(); const original = inspectCurrentProgress(storage);
  assert.match(original.summary, /245 XP/);
  storage.setItem('coptic-unit-progress:new', '["new"]');
  const before = [...storage.data];
  assert.throws(() => restoreBackup(makeBackup(new MemoryStorage()), true, storage, original.snapshot), /changed after/);
  assert.deepEqual([...storage.data], before);
  storage.setItem('coptic-progress', '{bad');
  assert.match(inspectCurrentProgress(storage).summary, /damaged or unsupported/);
  assert.equal(storage.getItem('coptic-progress'), '{bad');
});
test('UTF-8 decoding rejects damaged bytes and preserves BOM, decomposed Coptic and combining-mark order', () => {
  const backup = makeBackup(fixture());
  const encoded = new TextEncoder().encode('\uFEFF' + JSON.stringify(backup));
  assert.deepEqual(parseBackupBytes(encoded.buffer).records, backup.records);
  const invalid = new Uint8Array([0x7b, 0xff, 0x7d]);
  assert.throws(() => parseBackupBytes(invalid.buffer), /valid UTF-8/);
});
test('quota failure writing the journal leaves all existing records and recovery untouched', () => {
  const storage = fixture(), before = [...storage.data];
  storage.fail = (operation, key) => operation === 'set' && key === 'coptic-progress-transaction:v1';
  assert.throws(() => restoreBackup(makeBackup(new MemoryStorage()), true, storage));
  assert.deepEqual([...storage.data], before);
});
test('legacy journals recover immediately and damaged-journal quarantine failures preserve all evidence', () => {
  const storage = fixture(), records = makeBackup(storage).records;
  storage.setItem('coptic-progress-transaction:v1', JSON.stringify({ version: 1, records }));
  storage.removeItem('coptic-progress');
  recoverPending(storage);
  assert.deepEqual(makeBackup(storage).records, records);
  restoreBackup(makeBackup(new MemoryStorage()), true, storage);
  storage.setItem('coptic-progress-transaction:v1', '{damaged');
  const before = [...storage.data];
  storage.fail = (operation, key) => operation === 'set' && key === 'coptic-progress-damaged-journal:v1';
  assert.throws(() => undoRestore(storage));
  assert.deepEqual([...storage.data], before);
});
