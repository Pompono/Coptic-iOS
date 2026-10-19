export const AUTH_CALLBACK_URL = 'com.pompono.coptic://auth/callback';
export const AUTH_RECOVERY_CALLBACK_URL = 'com.pompono.coptic://auth/recovery';
export const AUTH_CALLBACK_PATH = '/auth/callback/';
export const AUTH_RECOVERY_CALLBACK_PATH = '/auth/recovery/';

export type ParsedAuthCallback =
  | { ok: true; code: string; isPasswordRecovery: boolean }
  | { ok: false; reason: 'not-callback' | 'provider-error' | 'missing-code' };

export function getAuthRedirectUrl(isNative: boolean, origin = '', purpose: 'default' | 'recovery' = 'default'): string {
  if (isNative) return purpose === 'recovery' ? AUTH_RECOVERY_CALLBACK_URL : AUTH_CALLBACK_URL;
  const path = purpose === 'recovery' ? AUTH_RECOVERY_CALLBACK_PATH : AUTH_CALLBACK_PATH;
  return `${origin.replace(/\/$/u, '')}${path}`;
}

export function isAuthCallbackPath(pathname: string): boolean {
  return pathname === AUTH_CALLBACK_PATH || pathname === AUTH_CALLBACK_PATH.slice(0, -1)
    || pathname === AUTH_RECOVERY_CALLBACK_PATH || pathname === AUTH_RECOVERY_CALLBACK_PATH.slice(0, -1);
}

export function parseAuthCallback(value: string): ParsedAuthCallback {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'not-callback' };
  }

  const isNativeCallback = url.protocol === 'com.pompono.coptic:'
    && url.hostname === 'auth'
    && (url.pathname === '/callback' || url.pathname === '/recovery');
  const isWebCallback = url.pathname === AUTH_CALLBACK_PATH
    || url.pathname === AUTH_CALLBACK_PATH.slice(0, -1)
    || url.pathname === AUTH_RECOVERY_CALLBACK_PATH
    || url.pathname === AUTH_RECOVERY_CALLBACK_PATH.slice(0, -1);
  if (!isNativeCallback && !isWebCallback) return { ok: false, reason: 'not-callback' };
  const fragment = new URLSearchParams(url.hash.replace(/^#/u, ''));
  const param = (key: string) => url.searchParams.get(key) ?? fragment.get(key);
  if (param('error') || param('error_code')) {
    return { ok: false, reason: 'provider-error' };
  }
  const code = param('code');
  if (!code || code.length > 4096) return { ok: false, reason: 'missing-code' };
  return {
    ok: true,
    code,
    // Only the purpose-specific redirect path identifies a recovery operation.
    // Query/fragment values such as type=recovery are caller-controlled and ignored.
    isPasswordRecovery: isNativeCallback ? url.pathname === '/recovery'
      : url.pathname === AUTH_RECOVERY_CALLBACK_PATH || url.pathname === AUTH_RECOVERY_CALLBACK_PATH.slice(0, -1),
  };
}

export function isAuthConfigured(url: string | undefined, publishableKey: string | undefined): boolean {
  if (!url || !publishableKey) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}
