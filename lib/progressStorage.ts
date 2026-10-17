import { parseLearning } from './learning/progress.mjs';
import { parseDeck } from './vocabulary/schedule.mjs';

export const RECOVERY_KEY = 'coptic-progress-recovery:v1';
const JOURNAL_KEY = 'coptic-progress-transaction:v1';
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
function apply(storage: Storage, records: Records) {
  const current = rawSnapshot(storage);
  for (const [key, raw] of Object.entries(records)) if (storage.getItem(key) !== raw) storage.setItem(key, raw);
  for (const key of Object.keys(current)) if (!Object.prototype.hasOwnProperty.call(records, key)) storage.removeItem(key);
  if (JSON.stringify(Object.entries(rawSnapshot(storage)).sort()) !== JSON.stringify(Object.entries(records).sort())) throw storageFailure();
}
// A pending journal always blocks normal reads/writes until rollback succeeds.
export function recoverPending(storage: Storage) {
  const raw = storage.getItem(JOURNAL_KEY);
  if (raw === null) return;
  const journal = JSON.parse(raw);
  if (!object(journal) || journal.version !== 1) throw new Error('Progress recovery needs attention. Export your recovery copy before continuing.');
  checkRecords(journal.records, false);
  apply(storage, journal.records);
  storage.removeItem(JOURNAL_KEY);
}
export function readRecord(key: string, storage: Storage = localStorage) {
  try { recoverPending(storage); const raw = storage.getItem(key); return raw === null ? null : validateRecord(key, raw); }
  catch (error) { reportProgressError(error); throw error; }
}
export function writeRecord(key: string, data: unknown, storage: Storage = localStorage) {
  try {
    recoverPending(storage);
    const raw = JSON.stringify(data);
    validateRecord(key, raw);
    const previous = storage.getItem(key);
    if (previous !== null) validateRecord(key, previous);
    storage.setItem(key, raw);
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
  try { data = JSON.parse(raw); } catch { throw new Error("This file is not valid JSON. Please select an exported progress backup."); }
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
export function restoreBackup(backup: Backup, confirmed: boolean, storage: Storage = localStorage) {
  if (!confirmed) return false;
  const validated = parseBackup(JSON.stringify(backup));
  replaceRecords(validated.records, storage);
  return true;
}
export function replaceRecords(records: Records, storage: Storage = localStorage) {
  checkRecords(records, true);
  recoverPending(storage);
  const previous = rawSnapshot(storage);
  const recovery = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), records: previous });
  // Keep the raw original even when it is malformed. Never include unrelated storage.
  storage.setItem(RECOVERY_KEY, recovery);
  if (storage.getItem(RECOVERY_KEY) !== recovery) throw storageFailure();
  storage.setItem(JOURNAL_KEY, recovery);
  if (storage.getItem(JOURNAL_KEY) !== recovery) throw storageFailure();
  try {
    apply(storage, records);
    storage.removeItem(JOURNAL_KEY);
  } catch {
    try { recoverPending(storage); } catch { throw new Error('Restore failed. Recovery is pending; learning writes are blocked until storage is available. Your original data is retained in the recovery copy.'); }
    throw new Error('Restore failed. Your previous progress has been restored.');
  }
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
  recoverPending(storage);
  const journal = JSON.stringify({ version: 1, records: rawSnapshot(storage) });
  storage.setItem(JOURNAL_KEY, journal);
  if (storage.getItem(JOURNAL_KEY) !== journal) throw storageFailure();
  try { apply(storage, data.records); storage.removeItem(JOURNAL_KEY); }
  catch { recoverPending(storage); throw new Error('Recovery failed. Please free device storage and retry.'); }
}
