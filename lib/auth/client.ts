'use client';

import { Capacitor } from '@capacitor/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAuthStorage, browserAuthStorage } from './storage';
import { isAuthConfigured } from './redirect';

let clientPromise: Promise<SupabaseClient> | undefined;

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const supabaseAuthConfigured = isAuthConfigured(supabaseUrl, supabasePublishableKey);

export function getAuthConfigurationError(): string {
  return 'Account sign-in is not configured in this build. You can keep using Coptic as a guest.';
}

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!supabaseAuthConfigured) return Promise.reject(new Error(getAuthConfigurationError()));
  if (!clientPromise) {
    clientPromise = makeClient().catch(error => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

async function makeClient(): Promise<SupabaseClient> {
  const isNative = Capacitor.isNativePlatform();
  let secureStorage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> } | null = null;

  if (isNative) {
    try {
      const { SecureAuthStorage } = await import('@coptic/secure-auth-storage');
      secureStorage = {
        getItem: async key => (await SecureAuthStorage.getItem({ key })).value,
        setItem: (key, value) => SecureAuthStorage.setItem({ key, value }),
        removeItem: key => SecureAuthStorage.removeItem({ key }),
      };
    } catch {
      throw new Error('Secure iPhone storage is unavailable. Update the app and try again; your account session was not saved.');
    }
  }

  const storage = createAuthStorage(
    isNative,
    secureStorage ?? { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
    browserAuthStorage(),
  );
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: !isNative,
      storage,
    },
  });
}
