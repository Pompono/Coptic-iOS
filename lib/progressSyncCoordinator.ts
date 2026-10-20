import type { ProgressSnapshot, SyncBase } from './progressSync';
import { removesProgressRecords, sameProgressRecords } from './progressSync';
import { reconcileProgressRecords } from './progressReconciliation';
import { withProgressSyncLock } from './progressSyncLock';
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
    const local = adapter.local();
    const cloud = await adapter.cloud(userId, signal);
    if (signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId)) return;
    if (!base) {
      // First sync is automatic only when there is exactly one known copy. A
      // nonempty local/cloud mismatch remains for Settings to confirm.
      if (!cloud && Object.keys(local).length) {
        const uploaded = await adapter.upload(0, local, signal);
        if (!signal.aborted && await adapter.currentUser() === userId && adapter.isEnabled(userId) && !('conflict' in uploaded)) {
          adapter.saveBase(userId, uploaded.revision, local);
          adapter.rememberUser(userId);
          if (!sameProgressRecords(adapter.local(), local)) rerun = true;
        }
      } else if (cloud && !Object.keys(local).length) {
        const latest = await adapter.cloud(userId, signal);
        if (!signal.aborted && latest?.revision === cloud.revision && await adapter.currentUser() === userId
          && adapter.isEnabled(userId) && !Object.keys(adapter.local()).length) {
          adapter.install(latest.records);
          adapter.saveBase(userId, latest.revision, latest.records);
          adapter.rememberUser(userId);
        }
      } else if (cloud && sameProgressRecords(local, cloud.records)) {
        adapter.saveBase(userId, cloud.revision, cloud.records);
        adapter.rememberUser(userId);
      }
      return;
    }
    if (!cloud) return;
    const localChanged = !sameProgressRecords(local, base.records);
    const cloudChanged = !sameProgressRecords(cloud.records, base.records);

    // A concurrent device may already have uploaded this exact local snapshot.
    // Adopt that confirmed revision instead of creating another cloud revision.
    if (sameProgressRecords(local, cloud.records)) {
      adapter.saveBase(userId, cloud.revision, cloud.records);
      adapter.rememberUser(userId);
      return;
    }

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

    if (localChanged && cloudChanged) {
      let confirmed = cloud;
      let mergedLocal = local;
      // A single retry is enough to absorb one competing CAS update; later races
      // remain a visible conflict in Settings instead of looping indefinitely.
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = reconcileProgressRecords(mergedLocal, confirmed.records);
        if (!result.safe || signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId)) return;
        const currentLocal = adapter.local();
        if (!sameProgressRecords(currentLocal, local)) return;
        const latest = await adapter.cloud(userId, signal);
        if (signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId) || !latest) return;
        if (latest.revision !== confirmed.revision) { confirmed = latest; continue; }
        if (sameProgressRecords(result.records, latest.records)) {
          if (sameProgressRecords(adapter.local(), local)) adapter.install(result.records);
          adapter.saveBase(userId, latest.revision, latest.records);
          adapter.rememberUser(userId);
          if (!sameProgressRecords(adapter.local(), latest.records)) rerun = true;
          return;
        }
        const written = await adapter.upload(confirmed.revision, result.records, signal);
        if (signal.aborted || await adapter.currentUser() !== userId || !adapter.isEnabled(userId)) return;
        if ('conflict' in written) {
          if (attempt === 0 && written.snapshot) { confirmed = written.snapshot; continue; }
          return;
        }
        const beforeInstall = adapter.local();
        if (sameProgressRecords(beforeInstall, local)) adapter.install(result.records);
        adapter.saveBase(userId, written.revision, result.records);
        adapter.rememberUser(userId);
        if (!sameProgressRecords(adapter.local(), result.records)) rerun = true;
        return;
      }
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
          await withProgressSyncLock(() => pass(signal));
        } while (rerun && !signal.aborted);
      } finally { active = null; activeSignal = null; }
    })();
    return active;
  }

  function cancel() { rerun = false; pendingSignal = null; }
  return { request, cancel };
}
