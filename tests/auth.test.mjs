import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTsModule } from './tsModule.mjs';

const { createAuthService, MINIMUM_PASSWORD_LENGTH } = await loadTsModule('lib/auth/service.ts');
const { createAuthStorage } = await loadTsModule('lib/auth/storage.ts');
const { getAuthRedirectUrl, parseAuthCallback, isAuthConfigured, AUTH_CALLBACK_URL } = await loadTsModule('lib/auth/redirect.ts');
const { bindNativeAuthLifecycle } = await loadTsModule('lib/auth/lifecycle.ts');

function makeApi(overrides = {}) {
  const calls = [];
  const session = { user: { id: 'user-1', email: 'learner@example.com', email_confirmed_at: '2026-01-01' }, expires_at: 9999999999 };
  const api = {
    signUp: async args => { calls.push(['signUp', args]); return { data: { user: session.user, session: null }, error: null }; },
    signInWithPassword: async args => { calls.push(['signIn', args]); return { data: { user: session.user, session }, error: null }; },
    signOut: async args => { calls.push(['signOut', args]); return { data: {}, error: null }; },
    resetPasswordForEmail: async (...args) => { calls.push(['resetPasswordForEmail', ...args]); return { data: {}, error: null }; },
    resend: async args => { calls.push(['resend', args]); return { data: {}, error: null }; },
    updateUser: async (...args) => { calls.push(['updateUser', ...args]); return { data: { user: session.user }, error: null }; },
    exchangeCodeForSession: async code => { calls.push(['exchangeCodeForSession', code]); return { data: { user: session.user, session }, error: null }; },
    getSession: async () => { calls.push(['getSession']); return { data: { session }, error: null }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    ...overrides,
  };
  return { api, calls, session };
}

test('account creation validates email and ten-character minimum before contacting Supabase', async () => {
  const { api, calls } = makeApi();
  const service = createAuthService({ api, redirectUrl: AUTH_CALLBACK_URL });
  await assert.rejects(service.register('bad-address', '1234567890'), /valid email/);
  await assert.rejects(service.register('learner@example.com', 'short'), new RegExp(String(MINIMUM_PASSWORD_LENGTH)));
  assert.equal(calls.length, 0);
  const result = await service.register(' Learner@Example.com ', 'long-enough-password', '  Reader  ');
  assert.deepEqual(result, { needsVerification: true, email: 'learner@example.com' });
  assert.equal(calls[0][1].options.data.display_name, 'Reader');
  assert.equal(calls[0][1].options.emailRedirectTo, AUTH_CALLBACK_URL);
});

test('sign-in accepts valid credentials and maps incorrect credentials to a safe message', async () => {
  const good = makeApi();
  const service = createAuthService({ api: good.api, redirectUrl: AUTH_CALLBACK_URL });
  assert.equal(await service.signIn('learner@example.com', 'password'), good.session);
  assert.equal(good.calls[0][1].email, 'learner@example.com');

  const wrong = makeApi({ signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } }) });
  await assert.rejects(createAuthService({ api: wrong.api, redirectUrl: AUTH_CALLBACK_URL }).signIn('learner@example.com', 'wrong'), /Email or password is incorrect/);
});

test('verification resend and password recovery use PKCE redirect and generic responses', async () => {
  const { api, calls } = makeApi();
  const service = createAuthService({ api, redirectUrl: AUTH_CALLBACK_URL });
  assert.match(await service.requestPasswordReset('someone@example.com'), /If an account can receive/);
  assert.match(await service.resendVerification('someone@example.com'), /If that address has a pending verification/);
  assert.equal(calls[0][0], 'resetPasswordForEmail');
  assert.equal(calls[0][2].redirectTo, AUTH_CALLBACK_URL);
  assert.equal(calls[1][1].type, 'signup');
  assert.equal(calls[1][1].options.emailRedirectTo, AUTH_CALLBACK_URL);
});

test('password recovery and verified email changes require valid inputs and native redirects', async () => {
  const { api, calls } = makeApi();
  const service = createAuthService({ api, redirectUrl: AUTH_CALLBACK_URL });
  await assert.rejects(service.updatePassword('123'), /at least 10/);
  await service.updatePassword('new-long-password');
  await service.changeEmail(' Next@example.com ');
  const emailCall = calls.find(call => call[0] === 'updateUser' && call[1].email);
  assert.equal(emailCall[1].email, 'next@example.com');
  assert.deepEqual(emailCall[2], { emailRedirectTo: AUTH_CALLBACK_URL });
});

test('session restoration returns the SDK session or safely returns to guest mode when absent', async () => {
  const existing = makeApi();
  const service = createAuthService({ api: existing.api, redirectUrl: AUTH_CALLBACK_URL });
  assert.equal(await service.restoreSession(), existing.session);
  const expired = makeApi({ getSession: async () => ({ data: { session: null }, error: null }) });
  assert.equal(await createAuthService({ api: expired.api, redirectUrl: AUTH_CALLBACK_URL }).restoreSession(), null);
});

test('network failures are actionable and do not expose server details', async () => {
  const api = makeApi({ signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'fetch failed: token=secret-access-token password=hunter2' } }) }).api;
  await assert.rejects(createAuthService({ api, redirectUrl: AUTH_CALLBACK_URL }).signIn('learner@example.com', 'hunter2'), error => {
    assert.match(error.message, /offline|connection/);
    assert.doesNotMatch(error.message, /secret-access-token|hunter2/);
    return true;
  });
});

test('callback accepts only the configured custom scheme or callback page and only exchanges a code', () => {
  const parsed = parseAuthCallback(`${AUTH_CALLBACK_URL}?code=one-time-code&type=recovery`);
  assert.deepEqual(parsed, { ok: true, code: 'one-time-code', isPasswordRecovery: true });
  assert.deepEqual(parseAuthCallback('com.pompono.coptic://auth/callback?access_token=leak'), { ok: false, reason: 'missing-code' });
  assert.deepEqual(parseAuthCallback('com.other.app://auth/callback?code=wrong'), { ok: false, reason: 'not-callback' });
  assert.deepEqual(parseAuthCallback('com.pompono.coptic://auth/callback?error=access_denied'), { ok: false, reason: 'provider-error' });
  assert.equal(getAuthRedirectUrl(true), AUTH_CALLBACK_URL);
  assert.equal(getAuthRedirectUrl(false, 'https://example.test/'), 'https://example.test/auth/callback/');
});

test('auth config stays optional so guests remain available without a publishable key', () => {
  assert.equal(isAuthConfigured(undefined, undefined), false);
  assert.equal(isAuthConfigured('https://vprlahihwqtkmhgxytiy.supabase.co', ''), false);
  assert.equal(isAuthConfigured('https://vprlahihwqtkmhgxytiy.supabase.co', 'sb_publishable_test'), true);
  assert.equal(isAuthConfigured('http://unsafe.test', 'sb_publishable_test'), false);
});

test('native session storage uses Keychain adapter while browser sessions use browser storage', async () => {
  const calls = [];
  const keychain = {
    getItem: async key => { calls.push(['keychain.get', key]); return 'secure-session'; },
    setItem: async (key, value) => calls.push(['keychain.set', key, value]),
    removeItem: async key => calls.push(['keychain.remove', key]),
  };
  const browser = {
    getItem: key => { calls.push(['browser.get', key]); return 'browser-session'; },
    setItem: (key, value) => calls.push(['browser.set', key, value]),
    removeItem: key => calls.push(['browser.remove', key]),
  };
  const native = createAuthStorage(true, keychain, browser);
  await native.setItem('auth-token', 'refresh-secret');
  assert.equal(await native.getItem('auth-token'), 'secure-session');
  await native.removeItem('auth-token');
  assert.equal(calls.filter(call => call[0].startsWith('browser.')).length, 0);
  assert.equal(calls[0][0], 'keychain.set');
  const web = createAuthStorage(false, keychain, browser);
  assert.equal(await web.getItem('auth-token'), 'browser-session');
});

test('native auth refresh starts on foreground, stops in background, and removes its listener', async () => {
  const calls = [];
  let stateHandler;
  let removed = false;
  const auth = {
    startAutoRefresh: async () => calls.push('start'),
    stopAutoRefresh: async () => calls.push('stop'),
  };
  const app = {
    getState: async () => ({ isActive: true }),
    addListener: async (_event, callback) => { stateHandler = callback; return { remove: async () => { removed = true; } }; },
  };
  const cleanup = await bindNativeAuthLifecycle(auth, app);
  stateHandler({ isActive: false });
  stateHandler({ isActive: true });
  await new Promise(resolve => setImmediate(resolve));
  await cleanup();
  assert.deepEqual(calls, ['start', 'stop', 'start']);
  assert.equal(removed, true);
});

test('sign-in and local sign-out do not change learning data or log authentication secrets', async () => {
  const progress = new Map([
    ['coptic-progress', '{"xp":42,"streak":3}'],
    ['coptic-unit-progress:lesson-a', '["step-1"]'],
    ['coptic-vocabulary:v1', '{"version":1,"cards":[]}'],
  ]);
  const before = [...progress.entries()];
  const { api, calls } = makeApi();
  const service = createAuthService({ api, redirectUrl: AUTH_CALLBACK_URL });
  const originalLog = console.log;
  const originalError = console.error;
  const output = [];
  console.log = (...args) => output.push(args.join(' '));
  console.error = (...args) => output.push(args.join(' '));
  try {
    await service.signIn('learner@example.com', 'a-secret-password');
    await service.signOut();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  assert.deepEqual([...progress.entries()], before);
  assert.deepEqual(calls.find(call => call[0] === 'signOut')[1], { scope: 'local' });
  assert.equal(output.join(' ').includes('a-secret-password'), false);
});

test('native iOS target registers the exact callback scheme and Capacitor URL forwarding', async () => {
  const plist = await readFile('ios/App/App/Info.plist', 'utf8');
  const appDelegate = await readFile('ios/App/App/AppDelegate.swift', 'utf8');
  assert.match(plist, /<string>com\.pompono\.coptic<\/string>/u);
  assert.match(appDelegate, /ApplicationDelegateProxy\.shared\.application\(app, open: url/u);
  assert.match(appDelegate, /ApplicationDelegateProxy\.shared\.application\(application, continue: userActivity/u);
});
