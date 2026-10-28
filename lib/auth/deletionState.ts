import type { AsyncStringStorage } from './storage';

export const DELETION_PENDING_KEY = 'coptic-account-deletion-pending:v1';
export const PROGRESS_REUSE_CONSENT_KEY = 'coptic-progress-reuse-consent:v1';
const RECEIPT_KEY = 'coptic-account-deletion-receipt:v1';
const REVOKED_KEY = 'coptic-account-deletion-revoked:v1';
type Receipt = { userId: string; receipt: string };

async function fingerprint(userId: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export function deletionSyncBlocked(storage: Storage = localStorage) {
  return storage.getItem(DELETION_PENDING_KEY) !== null;
}

export function createDeletionState(secure: AsyncStringStorage, local: Storage) {
  return {
    async read(): Promise<Receipt | null> {
      const raw = await secure.getItem(RECEIPT_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (typeof value.userId !== 'string' || !/^[a-f0-9]{64}$/.test(value.receipt)) throw new Error('Account deletion recovery could not be read. Your progress is safe.');
      return value;
    },
    async begin(userId: string): Promise<Receipt> {
      const existing = await this.read();
      if (existing) {
        if (existing.userId !== userId) throw new Error('Resolve the pending account deletion before changing accounts.');
        return existing;
      }
      // Set the non-identifying sync fence before any destructive network request.
      local.setItem(DELETION_PENDING_KEY, 'pending');
      local.setItem(PROGRESS_REUSE_CONSENT_KEY, 'required');
      const receipt = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
      const result = { userId, receipt };
      await secure.setItem(RECEIPT_KEY, JSON.stringify(result));
      return result;
    },
    async allows(userId: string): Promise<boolean> {
      const revoked: string[] = JSON.parse(await secure.getItem(REVOKED_KEY) ?? '[]');
      return !revoked.includes(await fingerprint(userId));
    },
    async revoke(userId: string) {
      const revoked: string[] = JSON.parse(await secure.getItem(REVOKED_KEY) ?? '[]');
      const hash = await fingerprint(userId);
      if (!revoked.includes(hash)) await secure.setItem(REVOKED_KEY, JSON.stringify([...revoked, hash]));
    },
    async finish(userId: string) {
      // Deliberately do not touch lesson records, preferences or recovery journals.
      local.setItem(PROGRESS_REUSE_CONSENT_KEY, 'required');
      local.removeItem(`coptic-progress-sync-base:v1:${userId}`);
      local.removeItem('coptic-progress-sync-last-user:v1');
      local.removeItem('coptic-progress-sync-enabled:v1');
      local.removeItem(DELETION_PENDING_KEY);
      await secure.removeItem(RECEIPT_KEY);
    },
  };
}

export type DeletionState = ReturnType<typeof createDeletionState>;

/** Reject late refresh/callback writes for permanently deleted accounts. */
export function deletionAwareAuthStorage(storage: AsyncStringStorage, state: DeletionState): AsyncStringStorage {
  async function allowed(raw: string | null) {
    if (!raw) return true;
    try { const value = JSON.parse(raw); return !value?.user?.id || await state.allows(value.user.id); }
    catch { return false; }
  }
  return {
    async getItem(key) {
      const raw = await storage.getItem(key);
      if (key.endsWith('-auth-token') && !await allowed(raw)) { await storage.removeItem(key); return null; }
      return raw;
    },
    async setItem(key, value) {
      if (key.endsWith('-auth-token') && !await allowed(value)) return;
      await storage.setItem(key, value);
      if (key.endsWith('-auth-token') && !await allowed(value) && await storage.getItem(key) === value) await storage.removeItem(key);
    },
    removeItem: key => storage.removeItem(key),
  };
}
