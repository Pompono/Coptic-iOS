'use client';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthConfigurationError, getPasswordRecoveryContext, getSupabaseClient, supabaseAuthConfigured } from '@/lib/auth/client';
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
      setSession(restored as Session | null);
      const isRecoveryAuthorized = restored
        ? await service.isPasswordRecoveryAuthorized(restored.user.id)
        : false;
      setRecoveryPending(isRecoveryAuthorized);
      if (isRecoveryAuthorized) router.replace('/account/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your session could not be restored. Try signing in again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

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
        setSession(restored as Session);
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
          setSession(nextSession);
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

        const { data: restored, error: restoreError } = await client.auth.getSession();
        if (restoreError) throw restoreError;
        if (!disposed) {
          setSession(restored.session);
          const service = serviceRef.current;
          const isRecoveryAuthorized = restored.session && service
            ? await service.isPasswordRecoveryAuthorized(restored.session.user.id)
            : false;
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
  }, [router]);

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
