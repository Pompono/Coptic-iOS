import type { SupabaseClient } from '@supabase/supabase-js';
import { parseBackup, replaceRecords, type Records } from './progressStorage';

export const PROGRESS_SYNC_OPT_IN_KEY = 'coptic-progress-sync-enabled:v1';
const SYNC_BASE_PREFIX = 'coptic-progress-sync-base:v1:';

export type ProgressSnapshot = { revision: number; records: Records; updatedAt: string | null };
export type SyncBase = { revision: number; records: Records };

function checkedRecords(value: unknown): Records {
  const backup = parseBackup(JSON.stringify({
    format: 'coptic-progress-backup', version: 1, exportedAt: new Date().toISOString(), records: value,
  }));
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
  localStorage.setItem(`${SYNC_BASE_PREFIX}${userId}`, JSON.stringify({ version: 1, revision, records: checkedRecords(records) }));
}

export async function fetchProgressSnapshot(client: SupabaseClient, userId: string): Promise<ProgressSnapshot | null> {
  const { data, error } = await client.from('progress_sync_snapshots')
    .select('revision, records, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    revision: Number(data.revision),
    records: checkedRecords(data.records),
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function writeProgressSnapshot(
  client: SupabaseClient,
  expectedRevision: number,
  records: Records,
): Promise<ProgressSnapshot | { conflict: true; snapshot: ProgressSnapshot | null }> {
  const { data, error } = await client.rpc('save_progress_snapshot', {
    p_expected_revision: expectedRevision,
    p_records: checkedRecords(records),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('The cloud progress response was incomplete. Your local progress is unchanged.');
  const snapshot = Number(row.revision) > 0 ? {
    revision: Number(row.revision),
    records: checkedRecords(row.records),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  } : null;
  if (row.conflict) return { conflict: true, snapshot };
  if (!snapshot) throw new Error('The cloud progress could not be saved. Your local progress is unchanged.');
  return snapshot;
}

export function installCloudProgress(records: Records) {
  replaceRecords(checkedRecords(records));
  window.dispatchEvent(new Event('coptic-progress-change'));
  window.dispatchEvent(new Event('coptic-learning-change'));
  window.dispatchEvent(new Event('coptic-vocabulary-change'));
  window.dispatchEvent(new Event('storage'));
}
