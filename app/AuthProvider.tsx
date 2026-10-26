'use client';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthConfigurationError, getDeletionState, getPasswordRecoveryContext, getSupabaseClient, supabaseAuthConfigured } from '@/lib/auth/client';
import { checkAccountDeletion } from '@/lib/auth/deletion';
import { getAuthRedirectUrl, isAuthCallbackPath } from '@/lib/auth/redirect';
import { bindNativeAuthLifecycle } from '@/lib/auth/lifecycle';
import { createAuthCallbackProcessor } from '@/lib/auth/callback';
import { createAuthService } from '@/lib/auth/service';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  error: string;
  recoveryPending: boolean;
  clearRecoveryPending(): void;
  clearError(): void;
  service: ReturnType<typeof createAuthService> | null;
  retrySession(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseAuthConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const [recoveryPending, setRecoveryPending] = useState(false);
  const serviceRef = useRef<ReturnType<typeof createAuthService> | null>(null);
  const sessionGeneration = useRef(0);
  const acceptSession = useCallback(async (candidate: Session | null) => {
    const generation = ++sessionGeneration.current;
    const allowed = !candidate || await (await getDeletionState()).allows(candidate.user.id);
    if (generation === sessionGeneration.current) setSession(allowed ? candidate : null);
  }, []);

  useEffect(() => {
    const deleted = () => { sessionGeneration.current++; setSession(null); setRecoveryPending(false); };
    window.addEventListener('coptic-account-deleted', deleted);
    return () => window.removeEventListener('coptic-account-deleted', deleted);
  }, []);

  const clearError = useCallback(() => setError(''), []);
  const clearRecoveryPending = useCallback(() => setRecoveryPending(false), []);

  const retrySession = useCallback(async () => {
    if (!supabaseAuthConfigured) return;
    setError('');
    setLoading(true);
    try {
      let service = serviceRef.current;
      if (!service) {
        const client = await getSupabaseClient();
        const recoveryContext = await getPasswordRecoveryContext();
        service = createAuthService({
          api: client.auth as never,
          redirectUrl: getAuthRedirectUrl(Capacitor.isNativePlatform(), window.location.origin),
          recoveryRedirectUrl: getAuthRedirectUrl(Capacitor.isNativePlatform(), window.location.origin, 'recovery'),
          recoveryContext,
        });
        serviceRef.current = service;
      }
      const restored = await service.restoreSession();
      await acceptSession(restored as Session | null);
      const hasRecoveryContext = await service.isPasswordRecoveryAuthorized(restored?.user.id);
      const isRecoveryAuthorized = Boolean(restored && hasRecoveryContext);
      setRecoveryPending(isRecoveryAuthorized);
      if (isRecoveryAuthorized) router.replace('/account/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your session could not be restored. Try signing in again.');
    } finally {
      setLoading(false);
    }
  }, [router, acceptSession]);

  useEffect(() => {
    if (!supabaseAuthConfigured) return;
    let disposed = false;
    let subscription: { unsubscribe(): void } | undefined;
    let appUrlListener: { remove(): Promise<void> } | undefined;
    let removeAppStateListener: (() => Promise<void>) | undefined;

    const callbackProcessor = createAuthCallbackProcessor({
      complete: async (code, isPasswordRecovery) => {
        const service = serviceRef.current;
        if (!service) throw new Error(getAuthConfigurationError());
        return service.completeCallback(code, isPasswordRecovery);
      },
      onComplete: (restored, isPasswordRecovery) => {
        if (disposed) return;
        setError('');
        void acceptSession(restored as Session);
        setRecoveryPending(isPasswordRecovery);
        router.replace('/account/');
      },
      onError: failure => { if (!disposed) setError(failure.message); },
    });

    const handleCallback = async (value: string) => {
      if (isAuthCallbackPath(window.location.pathname)) {
        window.history.replaceState(window.history.state, '', window.location.pathname);
      }
      await callbackProcessor(value);
    };

    void (async () => {
      try {
        const client = await getSupabaseClient();
        if (disposed) return;
        const recoveryContext = await getPasswordRecoveryContext();
        serviceRef.current = createAuthService({
          api: client.auth as never,
          redirectUrl: getAuthRedirectUrl(Capacitor.isNativePlatform(), window.location.origin),
          recoveryRedirectUrl: getAuthRedirectUrl(Capacitor.isNativePlatform(), window.location.origin, 'recovery'),
          recoveryContext,
        });
        const { data } = client.auth.onAuthStateChange((event, nextSession) => {
          if (disposed) return;
          void acceptSession(nextSession).catch(() => { if (!disposed) setSession(null); });
          if (event === 'PASSWORD_RECOVERY') {
            const service = serviceRef.current;
            if (service && nextSession?.user.id) {
              void service.isPasswordRecoveryAuthorized(nextSession.user.id).then(isAuthorized => {
                if (!disposed && isAuthorized) {
                  setRecoveryPending(true);
                  router.replace('/account/');
                }
              }).catch(failure => {
                if (!disposed) setError(failure instanceof Error ? failure.message : 'Password reset state could not be checked.');
              });
            }
          }
          if (event === 'SIGNED_OUT') {
            setRecoveryPending(false);
            void serviceRef.current?.cancelPasswordRecovery().catch(() => {
              if (!disposed) setError('Password reset state could not be cleared. Close and reopen the app before continuing.');
            });
          }
        });
        subscription = data.subscription;

        if (Capacitor.isNativePlatform()) {
          appUrlListener = await App.addListener('appUrlOpen', event => { void handleCallback(event.url); });
          removeAppStateListener = await bindNativeAuthLifecycle(client.auth, App);
          const launch = await App.getLaunchUrl();
          if (launch?.url) await handleCallback(launch.url);
        } else if (isAuthCallbackPath(window.location.pathname)) {
          await handleCallback(window.location.href);
        }

        // Resolve an interrupted deletion before restoring cached credentials.
        // Offline/unknown outcomes keep the durable sync fence and receipt intact.
        await checkAccountDeletion().catch(() => undefined);
        const { data: restored, error: restoreError } = await client.auth.getSession();
        if (restoreError) throw restoreError;
        if (!disposed) {
          await acceptSession(restored.session);
          const service = serviceRef.current;
          const hasRecoveryContext = service
            ? await service.isPasswordRecoveryAuthorized(restored.session?.user.id)
            : false;
          const isRecoveryAuthorized = Boolean(restored.session && hasRecoveryContext);
          setRecoveryPending(isRecoveryAuthorized);
          if (isRecoveryAuthorized) router.replace('/account/');
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : 'Account sign-in could not be initialized. You can continue as a guest.');
      } finally {
        if (!disposed) setLoading(false);
      }
    })();

    return () => {
      disposed = true;
      subscription?.unsubscribe();
      void appUrlListener?.remove();
      void removeAppStateListener?.();
    };
  }, [router, acceptSession]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: supabaseAuthConfigured,
    loading,
    session,
    error,
    recoveryPending,
    clearRecoveryPending,
    clearError,
    service: serviceRef.current,
    retrySession,
  }), [loading, session, error, recoveryPending, clearError, clearRecoveryPending, retrySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
