import type { ProgressSnapshot, SyncBase } from './progressSync';
import { removesProgressRecords, sameProgressRecords } from './progressSync';
import type { Records } from './progressStorage';

export type SyncCoordinatorAdapter = {
  currentUser(): Promise<string | null>;
  isEnabled(userId: string): boolean;
  lastUser(): string | null;
  base(userId: string): SyncBase | null;
  local(): Records;
  cloud(userId: string, signal: AbortSignal): Promise<ProgressSnapshot | null>;
  upload(revision: number, records: Records, signal: AbortSignal): Promise<ProgressSnapshot | { conflict: true; snapshot: ProgressSnapshot | null }>;
  install(records: Records): void;
  saveBase(userId: string, revision: number, records: Records): void;
  rememberUser(userId: string): void;
};

/** Debounced callers share one run; changes arriving during a run schedule one reconciliation pass. */
export function createProgressSyncCoordinator(adapter: SyncCoordinatorAdapter) {
  let active: Promise<void> | null = null;
  let rerun = false;
  let pendingSignal: AbortSignal | null = null;
  let activeSignal: AbortSignal | null = null;

  async function pass(signal: AbortSignal) {
    const userId = await adapter.currentUser();
    if (!userId || !adapter.isEnabled(userId) || signal.aborted) return;
    const lastUser = adapter.lastUser();
    if (lastUser && lastUser !== userId) return;
    const base = adapter.base(userId);
    if (!base) return; // Settings presents the first upload/download decision.

    const local = adapter.local();
    const cloud = await adapter.cloud(userId, signal);
    if (signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId) || !cloud) return;
    const localChanged = !sameProgressRecords(local, base.records);
    const cloudChanged = !sameProgressRecords(cloud.records, base.records);

    if (!localChanged && !cloudChanged) {
      if (cloud.revision !== base.revision) adapter.saveBase(userId, cloud.revision, cloud.records);
      adapter.rememberUser(userId);
      return;
    }

    if (localChanged && !cloudChanged && !removesProgressRecords(base.records, local)) {
      const uploaded = await adapter.upload(cloud.revision, local, signal);
      if (signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId)
        || 'conflict' in uploaded) return;
      // Keep the exact payload/revision sent. A concurrent local edit stays pending and gets another pass.
      adapter.saveBase(userId, uploaded.revision, local);
      adapter.rememberUser(userId);
      if (!sameProgressRecords(adapter.local(), local)) rerun = true;
      return;
    }

    if (!localChanged && cloudChanged && !removesProgressRecords(base.records, cloud.records)) {
      const latest = await adapter.cloud(userId, signal);
      if (signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId)
        || !latest || latest.revision !== cloud.revision) return;
      const immediatelyBeforeInstall = adapter.local();
      if (!sameProgressRecords(immediatelyBeforeInstall, base.records)) return;
      // Installation is synchronous and transactional; only then advance the local base.
      adapter.install(latest.records);
      adapter.saveBase(userId, latest.revision, latest.records);
      adapter.rememberUser(userId);
    }
  }

  function request(signal: AbortSignal = new AbortController().signal): Promise<void> {
    if (active) {
      if (activeSignal?.aborted && !signal.aborted) {
        pendingSignal = signal;
        return active.then(() => {
          if (pendingSignal !== signal || signal.aborted) return;
          pendingSignal = null;
          return request(signal);
        });
      }
      return active;
    }
    activeSignal = signal;
    active = (async () => {
      try {
        do {
          rerun = false;
          await pass(signal);
        } while (rerun && !signal.aborted);
      } finally { active = null; activeSignal = null; }
    })();
    return active;
  }

  function cancel() { rerun = false; pendingSignal = null; }
  return { request, cancel };
}
