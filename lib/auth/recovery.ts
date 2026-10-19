import type { AsyncStringStorage } from './storage';

const RECOVERY_CONTEXT_KEY = 'coptic-auth-password-recovery-v1';
const RECOVERY_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

type RecoveryContext = {
  status: 'authorized';
  createdAt: number;
  userId?: string;
};

export function createPasswordRecoveryContext(storage: AsyncStringStorage, now = () => Date.now()) {
  async function read(): Promise<RecoveryContext | null> {
    const value = await storage.getItem(RECOVERY_CONTEXT_KEY);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as Partial<RecoveryContext>;
      if (parsed.status !== 'authorized'
        || typeof parsed.createdAt !== 'number'
        || !Number.isFinite(parsed.createdAt)
        || parsed.createdAt > now()
        || now() - parsed.createdAt > RECOVERY_CONTEXT_TTL_MS) {
        await storage.removeItem(RECOVERY_CONTEXT_KEY);
        return null;
      }
      return { status: parsed.status, createdAt: parsed.createdAt, ...(typeof parsed.userId === 'string' ? { userId: parsed.userId } : {}) };
    } catch {
      await storage.removeItem(RECOVERY_CONTEXT_KEY);
      return null;
    }
  }

  return {
    async authorize(userId: string): Promise<boolean> {
      if (!userId) return false;
      const authorized: RecoveryContext = { status: 'authorized', createdAt: now(), userId };
      await storage.setItem(RECOVERY_CONTEXT_KEY, JSON.stringify(authorized));
      return true;
    },

    async isAuthorized(userId?: string): Promise<boolean> {
      const context = await read();
      return context?.status === 'authorized' && Boolean(userId) && context.userId === userId;
    },

    async clear(): Promise<void> {
      await storage.removeItem(RECOVERY_CONTEXT_KEY);
    },
  };
}

export type PasswordRecoveryContext = ReturnType<typeof createPasswordRecoveryContext>;
