import { parseAuthCallback } from './redirect';

export interface AuthCallbackSession {
  user: { id: string; email?: string; email_confirmed_at?: string | null };
}

type CallbackResult = 'ignored' | 'duplicate' | 'completed' | 'failed';

export function createAuthCallbackProcessor(options: {
  complete(code: string, isPasswordRecovery: boolean): Promise<AuthCallbackSession | null>;
  onComplete(session: AuthCallbackSession, isPasswordRecovery: boolean): void;
  onError(error: Error): void;
}): (value: string) => Promise<CallbackResult> {
  const inFlight = new Set<string>();
  const completed = new Set<string>();

  return async value => {
    const parsed = parseAuthCallback(value);
    if (parsed.ok === false) {
      if (parsed.reason !== 'not-callback') {
        options.onError(new Error('This account link is invalid or has expired. Request a new email and try again.'));
      }
      return 'ignored';
    }
    if (inFlight.has(parsed.code) || completed.has(parsed.code)) return 'duplicate';

    inFlight.add(parsed.code);
    try {
      const session = await options.complete(parsed.code, parsed.isPasswordRecovery);
      if (!session) throw new Error('This account link did not return a session. Request a new email and try again.');
      completed.add(parsed.code);
      if (completed.size > 16) completed.delete(completed.values().next().value as string);
      options.onComplete(session, parsed.isPasswordRecovery);
      return 'completed';
    } catch (failure) {
      options.onError(failure instanceof Error ? failure : new Error('This account link could not be completed. Request a new email and try again.'));
      return 'failed';
    } finally {
      inFlight.delete(parsed.code);
    }
  };
}
