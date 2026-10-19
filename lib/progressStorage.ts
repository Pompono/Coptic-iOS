import { parseLearning } from './learning/progress.mjs';
import { parseDeck } from './vocabulary/schedule.mjs';

export const RECOVERY_KEY = 'coptic-progress-recovery:v1';
const JOURNAL_KEY = 'coptic-progress-transaction:v1';
const DAMAGED_JOURNAL_KEY = 'coptic-progress-damaged-journal:v1';
const JOURNAL_LEASE_MS = 30000;
const lastRead = new WeakMap<Storage, Map<string, string | null>>();
class DamagedJournalError extends Error {}
export type Records = Record<string, string>;
export type Backup = { format: 'coptic-progress-backup'; version: 1; exportedAt: string; records: Records };
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function isProgressKey(key: string) {
  return ['coptic-progress', 'coptic-learning:v1', 'coptic-vocabulary:v1', 'coptic-reader:v1'].includes(key)
    || /^(coptic-unit-progress:|coptic-unit-failed-steps:).+/.test(key);
}
export function validateRecord(key: string, raw: string) {
  if (!isProgressKey(key)) throw new Error('Unrecognized progress record.');
  let data: any;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Progress record ${key} contains corrupted JSON. The stored copy has been preserved.`); }
  if (object(data) && data.version !== undefined && data.version !== 1) throw new Error(`Progress record ${key} has an unsupported version. The stored copy has been preserved.`);
  let valid = false;
  if (key.startsWith('coptic-unit-')) valid = strings(data);
  if (key === 'coptic-progress') valid = object(data) && count(data.xp) && count(data.streak)
    && (data.lastCompletedDate === null || (typeof data.lastCompletedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.lastCompletedDate))) && strings(data.completedLessons);
  if (key === 'coptic-reader:v1') valid = object(data) && data.version === 1 && typeof data.passageId === 'string' && typeof data.draft === 'string' && data.draft.length <= 6000;
  if (key === 'coptic-learning:v1') {
    const learning = parseLearning(raw);
    valid = Object.values(learning.skills).every((skill: any) =>
      ['unitId', 'audio', 'pos', 'explanation'].every(field => skill[field] === undefined || typeof skill[field] === 'string')
      && ['unitIds', 'accepted'].every(field => skill[field] === undefined || strings(skill[field]))
      && (skill.needsPractice === undefined || typeof skill.needsPractice === 'boolean')
      && (skill.lastSuccessfulDay === undefined || skill.lastSuccessfulDay === null || count(skill.lastSuccessfulDay)));
  }
  if (key === 'coptic-vocabulary:v1') {
    valid = parseDeck(raw).every(card =>
      ['pos', 'dialect', 'context', 'source', 'audio'].every(field => card[field] === undefined || typeof card[field] === 'string')
      && (card.lastReviewedAt === undefined || card.lastReviewedAt === null || count(card.lastReviewedAt)));
  }
  if (!valid) throw new Error(`Progress record ${key} is damaged or unsupported. The stored copy has been preserved.`);
  return data;
}
function storageFailure() { return new Error('Progress storage is unavailable or could not be updated. Your saved data has not been reset.'); }
export function reportProgressError(error: unknown) {
  const message = error instanceof Error ? error.message : storageFailure().message;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('coptic-progress-error', { detail: message }));
  return message;
}
function rawSnapshot(storage: Storage): Records {
  const records: Records = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isProgressKey(key)) {
      const raw = storage.getItem(key);
      if (raw === null) throw storageFailure();
      records[key] = raw;
    }
  }
  return records;
}
function checkRecords(value: unknown, validate: boolean): asserts value is Records {
  if (!object(value)) throw new Error('Invalid progress records.');
  for (const [key, raw] of Object.entries(value)) {
    if (!isProgressKey(key) || typeof raw !== 'string') throw new Error('Invalid progress record.');
    if (validate) validateRecord(key, raw);
  }
}
function snapshotDigest(records: Records) {
  // Detect accidental journal damage, not an authenticity/security signature.
  const text = JSON.stringify(Object.entries(records).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
function journalData(raw: string) {
  try {
    const data = JSON.parse(raw);
    if (!object(data) || data.version !== 1) throw new Error();
    checkRecords(data.records, false);
    if (data.digest !== undefined && data.digest !== snapshotDigest(data.records)) throw new Error();
    if (data.activeUntil !== undefined && (!count(data.activeUntil) || typeof data.owner !== 'string' || !data.digest)) throw new Error();
    return data;
  } catch { throw new DamagedJournalError('The recovery journal is damaged or unsupported. It has been preserved. Use Recover previous progress in Settings.'); }
}
function assertJournal(storage: Storage, journal: string) {
  if (storage.getItem(JOURNAL_KEY) !== journal) throw new Error('Progress changed in another window. Reload before continuing.');
}
function apply(storage: Storage, records: Records, journal: string) {
  const current = rawSnapshot(storage);
  for (const [key, raw] of Object.entries(records)) {
    assertJournal(storage, journal);
    if (storage.getItem(key) !== raw) storage.setItem(key, raw);
  }
  for (const key of Object.keys(current)) {
    assertJournal(storage, journal);
    if (!Object.prototype.hasOwnProperty.call(records, key)) storage.removeItem(key);
  }
  assertJournal(storage, journal);
  if (JSON.stringify(Object.entries(rawSnapshot(storage)).sort()) !== JSON.stringify(Object.entries(records).sort())) throw storageFailure();
}
function rollback(storage: Storage, raw: string) {
  assertJournal(storage, raw);
  apply(storage, journalData(raw).records, raw);
  assertJournal(storage, raw);
  storage.removeItem(JOURNAL_KEY);
}
// A different window must not roll back a live synchronous restore. After a crash,
// wait at most 30 seconds before replaying its durable journal. Legacy journals
// without lease metadata are still supported and recovered immediately.
export function recoverPending(storage: Storage, now = Date.now()) {
  const raw = storage.getItem(JOURNAL_KEY);
  if (raw === null) return;
  const journal = journalData(raw);
  if (journal.activeUntil > now) throw new Error('Progress restoration is active in another window or was interrupted. Wait 30 seconds, then reload. Saved progress has been preserved.');
  rollback(storage, raw);
}
export function readRecord(key: string, storage: Storage = localStorage) {
  try {
    recoverPending(storage);
    const raw = storage.getItem(key);
    const data = raw === null ? null : validateRecord(key, raw);
    if (!lastRead.has(storage)) lastRead.set(storage, new Map());
    lastRead.get(storage)!.set(key, raw);
    return data;
  }
  catch (error) { reportProgressError(error); throw error; }
}
export function writeRecord(key: string, data: unknown, storage: Storage = localStorage) {
  try {
    recoverPending(storage);
    const raw = JSON.stringify(data);
    validateRecord(key, raw);
    const previous = storage.getItem(key);
    if (previous !== null) validateRecord(key, previous);
    const seen = lastRead.get(storage);
    if (seen?.has(key) && seen.get(key) !== previous) throw new Error('Saved progress changed in another window. Reload before saving to avoid replacing newer progress.');
    // Recheck the journal immediately before the per-key atomic write.
    if (storage.getItem(JOURNAL_KEY) !== null || storage.getItem(key) !== previous) throw new Error('Saved progress changed in another window. Reload before saving.');
    storage.setItem(key, raw);
    seen?.set(key, raw);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('coptic-progress-change'));
  } catch (error) { reportProgressError(error); throw error; }
}
export function makeBackup(storage: Storage = localStorage): Backup {
  recoverPending(storage);
  const records = rawSnapshot(storage);
  checkRecords(records, true);
  return { format: 'coptic-progress-backup', version: 1, exportedAt: new Date().toISOString(), records };
}
export function parseBackup(raw: string): Backup {
  let data: any;
  try { data = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { throw new Error("This file is not valid JSON. Please select an exported progress backup."); }
  if (!object(data) || data.format !== 'coptic-progress-backup' || data.version !== 1) throw new Error('Invalid or unsupported progress backup version.');
  if (typeof data.exportedAt !== 'string' || !Number.isFinite(Date.parse(data.exportedAt))) throw new Error('Invalid backup date.');
  checkRecords(data.records, true);
  return data as Backup;
}
export function backupSummary(backup: Backup) {
  const records = backup.records;
  const totals = records['coptic-progress'] ? validateRecord('coptic-progress', records['coptic-progress']) : { xp: 0, streak: 0, completedLessons: [] };
  const steps = Object.entries(records).filter(([key]) => key.startsWith('coptic-unit-progress:')).reduce((n, [, raw]) => n + JSON.parse(raw).length, 0);
  const failed = Object.entries(records).filter(([key]) => key.startsWith('coptic-unit-failed-steps:')).reduce((n, [, raw]) => n + JSON.parse(raw).length, 0);
  const vocabulary = records['coptic-vocabulary:v1'] ? parseDeck(records['coptic-vocabulary:v1']).length : 0;
  const skills = records['coptic-learning:v1'] ? Object.keys(parseLearning(records['coptic-learning:v1']).skills).length : 0;
  return `${totals.xp} XP · ${totals.streak} streak · ${totals.completedLessons.length} completed lessons · ${steps} completed steps · ${failed} steps to retry · ${vocabulary} saved words · ${skills} practiced items · ${records['coptic-reader:v1'] ? '1 saved passage' : 'no saved passage'}`;
}
export function inspectCurrentProgress(storage: Storage = localStorage) {
  recoverPending(storage);
  const records = rawSnapshot(storage);
  let summary: string;
  try { checkRecords(records, true); summary = backupSummary({ format: 'coptic-progress-backup', version: 1, exportedAt: new Date().toISOString(), records }); }
  catch { summary = 'Current saved progress is damaged or unsupported. Its original records will be preserved in the recovery copy.'; }
  return { summary, snapshot: JSON.stringify(Object.entries(records).sort()) };
}
export function parseBackupBytes(bytes: ArrayBuffer) {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('The backup is not valid UTF-8 text. Please select an undamaged JSON backup.'); }
  return parseBackup(text);
}
export function restoreBackup(backup: Backup, confirmed: boolean, storage: Storage = localStorage, expectedCurrent?: string) {
  if (!confirmed) return false;
  const validated = parseBackup(JSON.stringify(backup));
  if (expectedCurrent !== undefined && inspectCurrentProgress(storage).snapshot !== expectedCurrent) throw new Error('Current progress changed after you selected this file. Select the backup again to review the new replacement summary.');
  replaceRecords(validated.records, storage);
  return true;
}
function transaction(storage: Storage, records: Records, keepRecovery: boolean) {
  const previous = rawSnapshot(storage);
  const recovery = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), records: previous });
  const journal = JSON.stringify({ version: 1, records: previous, digest: snapshotDigest(previous), owner: Math.random().toString(36), activeUntil: Date.now() + JOURNAL_LEASE_MS });
  if (storage.getItem(JOURNAL_KEY) !== null) throw new Error('Progress recovery is pending. Reload before continuing.');
  storage.setItem(JOURNAL_KEY, journal);
  if (storage.getItem(JOURNAL_KEY) !== journal) throw storageFailure();
  // A competing write before journal acquisition must never be rolled back as
  // though it belonged to this transaction.
  if (JSON.stringify(Object.entries(rawSnapshot(storage)).sort()) !== JSON.stringify(Object.entries(previous).sort())) {
    assertJournal(storage, journal);
    storage.removeItem(JOURNAL_KEY);
    throw new Error('Progress changed in another window. Reload before continuing.');
  }
  try {
    if (keepRecovery) {
      storage.setItem(RECOVERY_KEY, recovery);
      if (storage.getItem(RECOVERY_KEY) !== recovery) throw storageFailure();
    }
    apply(storage, records, journal);
    assertJournal(storage, journal);
    storage.removeItem(JOURNAL_KEY);
  } catch {
    try { rollback(storage, journal); } catch { throw new Error('Restore failed. Recovery is pending; learning writes are blocked. Free device storage if necessary, wait 30 seconds, then reload. Your original data is retained.'); }
    throw new Error('Restore failed. Your previous progress has been restored.');
  }
}
export function replaceRecords(records: Records, storage: Storage = localStorage) {
  checkRecords(records, true);
  recoverPending(storage);
  transaction(storage, records, true);
}
export function recoveryFile(storage: Storage = localStorage) {
  const raw = storage.getItem(RECOVERY_KEY);
  if (raw === null) throw new Error('No recovery copy is available.');
  const data = JSON.parse(raw);
  if (data.version !== 1) throw new Error('Unsupported recovery copy.');
  checkRecords(data.records, false);
  return raw;
}
export function undoRestore(storage: Storage = localStorage) {
  const data = JSON.parse(recoveryFile(storage));
  try { recoverPending(storage); }
  catch (error) {
    if (!(error instanceof DamagedJournalError)) throw error;
    // Only this explicitly confirmed action can quarantine a damaged journal.
    // Verify the copy before replacing its marker; never discard the evidence.
    const damaged = storage.getItem(JOURNAL_KEY)!;
    storage.setItem(DAMAGED_JOURNAL_KEY, damaged);
    if (storage.getItem(DAMAGED_JOURNAL_KEY) !== damaged) throw storageFailure();
    assertJournal(storage, damaged);
    storage.removeItem(JOURNAL_KEY);
  }
  transaction(storage, data.records, false);
}
