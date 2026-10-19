import type { AsyncStringStorage } from './storage';

const RECOVERY_CONTEXT_KEY = 'coptic-auth-password-recovery-v1';
const RECOVERY_CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

type RecoveryContext = {
  status: 'requested' | 'authorized';
  createdAt: number;
  userId?: string;
};

export function createPasswordRecoveryContext(storage: AsyncStringStorage, now = () => Date.now()) {
  async function read(): Promise<RecoveryContext | null> {
    const value = await storage.getItem(RECOVERY_CONTEXT_KEY);
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as Partial<RecoveryContext>;
      if ((parsed.status !== 'requested' && parsed.status !== 'authorized')
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
    async begin(): Promise<void> {
      await storage.setItem(RECOVERY_CONTEXT_KEY, JSON.stringify({ status: 'requested', createdAt: now() } satisfies RecoveryContext));
    },

    async authorize(userId: string): Promise<boolean> {
      const context = await read();
      if (!context || context.status !== 'requested' || !userId) return false;
      await storage.setItem(RECOVERY_CONTEXT_KEY, JSON.stringify({ ...context, status: 'authorized', userId } satisfies RecoveryContext));
      return true;
    },

    async isRequested(): Promise<boolean> {
      return (await read())?.status === 'requested';
    },

    async isAuthorized(userId?: string): Promise<boolean> {
      const context = await read();
      return context?.status === 'authorized' && Boolean(context.userId) && (!userId || context.userId === userId);
    },

    async clear(): Promise<void> {
      await storage.removeItem(RECOVERY_CONTEXT_KEY);
    },
  };
}

export type PasswordRecoveryContext = ReturnType<typeof createPasswordRecoveryContext>;
