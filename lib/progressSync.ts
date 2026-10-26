import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBackup, replaceRecordsForCloudSync, type Records } from './progressStorage';
import { deletionSyncBlocked } from './auth/deletionState';

function requireSyncAvailable() {
  if (typeof localStorage !== 'undefined' && deletionSyncBlocked()) throw new Error('Account deletion is pending. Cloud sync is paused.');
}

export const PROGRESS_SYNC_OPT_IN_KEY = 'coptic-progress-sync-enabled:v1';
const SYNC_BASE_PREFIX = 'coptic-progress-sync-base:v1:';
const MAX_CLOUD_SNAPSHOT_BYTES = 20 * 1024 * 1024;
const MAX_CLOUD_RECORDS = 10_000;

export type ProgressSnapshot = { revision: number; records: Records; updatedAt: string | null };
export type SyncBase = { revision: number; records: Records };

const SAFE_SYNC_ERROR_DESCRIPTIONS: Record<string, string> = {
  '22003': 'The cloud progress revision reached its supported limit.',
  '22023': 'The cloud rejected a progress record as unsupported or outside its allowed limits.',
  '23505': 'A concurrent save conflicted with this upload. Sync again to review the latest copy.',
  '28000': 'The sign-in session was not accepted. Sign in again before syncing.',
  '40001': 'Cloud progress changed on another device. Sync again to review the latest copy.',
  '42501': 'The cloud permission check rejected this request.',
  '42702': 'The cloud sync function has an ambiguous database column reference.',
  '42883': 'The cloud sync function is missing or has an incompatible signature.',
  PGRST202: 'The cloud sync function is unavailable in the API schema cache.',
  PGRST301: 'The sign-in session was not accepted. Sign in again before syncing.',
};

/** Report a stable code and allowlisted description; never expose raw server details or record values. */
export function progressSyncErrorMessage(error: unknown) {
  const candidate = error && typeof error === 'object' ? error as { code?: unknown } : {};
  const rawCode = typeof candidate.code === 'string' ? candidate.code : '';
  const code = /^[0-9A-Z]{5}$/.test(rawCode) || /^PGRST\d{3}$/.test(rawCode) ? rawCode : 'unknown';
  const description = SAFE_SYNC_ERROR_DESCRIPTIONS[code] ?? 'The cloud service rejected the request. Contact support with this code.';
  return `Cloud sync failed (${code}): ${description} Your local progress is unchanged.`;
}

function checkedRecords(value: unknown): Records {
  const backup = parseBackup(JSON.stringify({
    format: 'coptic-progress-backup', version: 1, exportedAt: new Date().toISOString(), records: value,
  }));
  if (Object.keys(backup.records).length > MAX_CLOUD_RECORDS) {
    throw new Error('This progress snapshot has too many records to sync. Your saved progress is unchanged.');
  }
  if (new TextEncoder().encode(JSON.stringify(backup.records)).byteLength > MAX_CLOUD_SNAPSHOT_BYTES) {
    throw new Error('This progress snapshot is larger than the cloud sync limit. Your saved progress is unchanged.');
  }
  return backup.records;
}

function sortRecords(records: Records) {
  return Object.fromEntries(Object.entries(records).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function sameProgressRecords(left: Records, right: Records) {
  return JSON.stringify(sortRecords(left)) === JSON.stringify(sortRecords(right));
}

export function removesProgressRecords(previous: Records, next: Records) {
  for (const [key, oldRaw] of Object.entries(previous)) {
    const newRaw = next[key];
    if (newRaw === undefined) return true;
    try {
      const oldValue = JSON.parse(oldRaw);
      const newValue = JSON.parse(newRaw);
      if (key.startsWith('coptic-unit-progress:')) {
        if (!Array.isArray(newValue) || oldValue.some((step: unknown) => !newValue.includes(step))) return true;
      } else if (key === 'coptic-progress') {
        if (newValue.xp < oldValue.xp || newValue.streak < oldValue.streak
          || oldValue.completedLessons.some((lesson: unknown) => !newValue.completedLessons.includes(lesson))
          || (oldValue.lastCompletedDate && (!newValue.lastCompletedDate
            || newValue.lastCompletedDate < oldValue.lastCompletedDate))) return true;
      } else if (key === 'coptic-learning:v1') {
        for (const [skillId, oldSkill] of Object.entries(oldValue.skills ?? {})) {
          const newSkill = newValue.skills?.[skillId];
          if (!newSkill || ['attempts', 'correct', 'lapses', 'successfulDays'].some(field => newSkill[field] < (oldSkill as any)[field])) return true;
        }
      } else if (key === 'coptic-vocabulary:v1') {
        const ids = new Set((newValue.cards ?? []).map((card: { id: string }) => card.id));
        if ((oldValue.cards ?? []).some((card: { id: string }) => !ids.has(card.id))) return true;
      }
    } catch { return true; }
  }
  return false;
}

export function readSyncBase(userId: string): SyncBase | null {
  const raw = localStorage.getItem(`${SYNC_BASE_PREFIX}${userId}`);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1) return null;
    return { revision: value.revision, records: checkedRecords(value.records) };
  } catch { return null; }
}

export function saveSyncBase(userId: string, revision: number, records: Records) {
  requireSyncAvailable();
  localStorage.setItem(`${SYNC_BASE_PREFIX}${userId}`, JSON.stringify({ version: 1, revision, records: checkedRecords(records) }));
}

export async function fetchProgressSnapshot(client: SupabaseClient, userId: string, signal?: AbortSignal): Promise<ProgressSnapshot | null> {
  requireSyncAvailable();
  let query = client.from('progress_sync_snapshots').select('revision, records, updated_at').eq('user_id', userId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const revision = Number(data.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('The cloud progress revision is invalid. Local progress was not changed.');
  return {
    revision,
    records: checkedRecords(data.records),
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function writeProgressSnapshot(
  client: SupabaseClient,
  expectedRevision: number,
  records: Records,
  signal?: AbortSignal,
): Promise<ProgressSnapshot | { conflict: true; snapshot: ProgressSnapshot | null }> {
  requireSyncAvailable();
  let query = client.rpc('save_progress_snapshot', {
    p_expected_revision: expectedRevision,
    p_records: checkedRecords(records),
  });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('The cloud progress response was incomplete. Your local progress is unchanged.');
  const rowRevision = Number(row.revision);
  if (!Number.isSafeInteger(rowRevision) || rowRevision < 0) throw new Error('The cloud progress revision is invalid. Local progress was not changed.');
  const snapshot = rowRevision > 0 ? {
    revision: rowRevision,
    records: checkedRecords(row.records),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  } : null;
  if (row.conflict) return { conflict: true, snapshot };
  if (!snapshot) throw new Error('The cloud progress could not be saved. Your local progress is unchanged.');
  return snapshot;
}

export function installCloudProgress(records: Records) {
  requireSyncAvailable();
  replaceRecordsForCloudSync(checkedRecords(records));
  window.dispatchEvent(new Event('coptic-learning-change'));
  window.dispatchEvent(new Event('coptic-vocabulary-change'));
  window.dispatchEvent(new Event('storage'));
}
