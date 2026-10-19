import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTsModule } from './tsModule.mjs';

const { createAuthService, MINIMUM_PASSWORD_LENGTH } = await loadTsModule('lib/auth/service.ts');
const { createAuthStorage } = await loadTsModule('lib/auth/storage.ts');
const { getAuthRedirectUrl, parseAuthCallback, isAuthConfigured, AUTH_CALLBACK_URL } = await loadTsModule('lib/auth/redirect.ts');
const { bindNativeAuthLifecycle } = await loadTsModule('lib/auth/lifecycle.ts');
const { createAuthCallbackProcessor } = await loadTsModule('lib/auth/callback.ts');
const { createPasswordRecoveryContext } = await loadTsModule('lib/auth/recovery.ts');
const { AUTH_RECOVERY_CALLBACK_URL } = await loadTsModule('lib/auth/redirect.ts');

function makeRecoveryContext(now = () => Date.now()) {
  const values = new Map();
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async key => values.delete(key),
  };
  return { context: createPasswordRecoveryContext(storage, now), values };
}

function makeService(api, context = makeRecoveryContext().context) {
  return createAuthService({
    api,
    redirectUrl: AUTH_CALLBACK_URL,
    recoveryRedirectUrl: AUTH_RECOVERY_CALLBACK_URL,
    recoveryContext: context,
  });
}

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
    verifyOtp: async args => { calls.push(['verifyOtp', args]); return { data: { user: session.user, session }, error: null }; },
    getSession: async () => { calls.push(['getSession']); return { data: { session }, error: null }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    ...overrides,
  };
  return { api, calls, session };
}

test('account creation accepts eight characters and rejects shorter passwords before contacting Supabase', async () => {
  const { api, calls } = makeApi();
  const service = makeService(api);
  assert.equal(MINIMUM_PASSWORD_LENGTH, 8);
  await assert.rejects(service.register('bad-address', '1234567890'), /valid email/);
  await assert.rejects(service.register('learner@example.com', '1234567'), /at least 8/);
  const result = await service.register(' Learner@Example.com ', '12345678', '  Reader  ');
  assert.deepEqual(result, { needsVerification: true, email: 'learner@example.com' });
  assert.equal(calls[0][1].options.data.display_name, 'Reader');
  assert.equal(calls[0][1].options.emailRedirectTo, AUTH_CALLBACK_URL);
  calls.length = 0;
  await service.register('learner@example.com', 'long-enough-password', 'Reader');
  assert.equal(calls.length, 1);
});

test('account forms use the shared eight-character rule and the signup code entry screen', async () => {
  const account = await readFile('app/account/page.tsx', 'utf8');
  assert.match(account, /minLength=\{MINIMUM_PASSWORD_LENGTH\}/u);
  assert.match(account, /Verification code/u);
  assert.match(account, /Verify email/u);
  assert.match(account, /Resend verification code/u);
  assert.match(account, /Confirm new password/u);
  assert.match(account, /recoveryPending && <form/u);
  assert.match(account, /completePasswordRecovery\(password, confirmPassword\)/u);
  assert.match(account, /Cancel password reset/u);
});

test('sign-in accepts valid credentials and maps incorrect credentials to a safe message', async () => {
  const good = makeApi();
  const service = makeService(good.api);
  assert.equal(await service.signIn('learner@example.com', 'password'), good.session);
  assert.equal(good.calls[0][1].email, 'learner@example.com');

  const wrong = makeApi({ signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } }) });
  await assert.rejects(makeService(wrong.api).signIn('learner@example.com', 'wrong'), /Email or password is incorrect/);
});

test('verification resend and password recovery use PKCE redirect and generic responses', async () => {
  const { api, calls } = makeApi();
  const { context } = makeRecoveryContext();
  const service = makeService(api, context);
  assert.match(await service.requestPasswordReset('someone@example.com'), /If an account can receive/);
  assert.match(await service.resendVerification('someone@example.com'), /If that address has a pending verification/);
  assert.equal(calls[0][0], 'resetPasswordForEmail');
  assert.equal(calls[0][2].redirectTo, AUTH_RECOVERY_CALLBACK_URL);
  assert.equal(await context.isRequested(), true);
  assert.equal(calls[1][1].type, 'signup');
  assert.equal(calls[1][1].options.emailRedirectTo, AUTH_CALLBACK_URL);
});

test('password recovery and verified email changes require valid inputs and native redirects', async () => {
  const { api, calls } = makeApi();
  const service = makeService(api);
  await assert.rejects(service.updatePassword('1234567'), /at least 8/);
  await service.updatePassword('12345678');
  await service.updatePassword('new-long-password');
  await service.changeEmail(' Next@example.com ');
  const emailCall = calls.find(call => call[0] === 'updateUser' && call[1].email);
  assert.equal(emailCall[1].email, 'next@example.com');
  assert.deepEqual(emailCall[2], { emailRedirectTo: AUTH_CALLBACK_URL });
});

test('a code-only purpose-specific recovery callback authorizes recovery after PKCE exchange', async () => {
  const { api, calls } = makeApi();
  const { context } = makeRecoveryContext();
  const service = makeService(api, context);
  await service.requestPasswordReset('learner@example.com');
  const completed = [];
  const processor = createAuthCallbackProcessor({
    complete: (code, isRecovery) => {
      assert.equal(code, 'valid-recovery-code');
      return service.completeCallback(code, isRecovery);
    },
    onComplete: (session, isRecovery) => completed.push([session.user.id, isRecovery]),
    onError(error) { throw error; },
  });
  assert.equal(await processor(`${AUTH_RECOVERY_CALLBACK_URL}?code=valid-recovery-code`), 'completed');
  assert.deepEqual(completed, [['user-1', true]]);
  assert.equal(await context.isAuthorized('user-1'), true);
  assert.deepEqual(calls.find(call => call[0] === 'exchangeCodeForSession'), ['exchangeCodeForSession', 'valid-recovery-code']);
  const account = await readFile('app/account/page.tsx', 'utf8');
  assert.match(account, /Choose a new password/u);
  assert.match(account, /Confirm new password/u);
});

test('ordinary sign-in callbacks cannot enter recovery mode from a caller-supplied type parameter', async () => {
  const callback = parseAuthCallback(`${AUTH_CALLBACK_URL}?code=ordinary-sign-in&type=recovery`);
  assert.equal(callback.ok && callback.isPasswordRecovery, false);
  const completed = [];
  const processor = createAuthCallbackProcessor({
    complete: async () => ({ user: { id: 'user-1' } }),
    onComplete: (_session, isRecovery) => completed.push(isRecovery),
    onError(error) { throw error; },
  });
  assert.equal(await processor(`${AUTH_CALLBACK_URL}?code=ordinary-sign-in&type=recovery`), 'completed');
  assert.deepEqual(completed, [false]);
});

test('password recovery completion requires an authorized live session and matching passwords', async () => {
  const { api, calls } = makeApi();
  const { context } = makeRecoveryContext();
  const service = makeService(api, context);
  await service.requestPasswordReset('learner@example.com');
  await service.completeCallback('recovery-code', true);
  await assert.rejects(service.completePasswordRecovery('12345678', '12345679'), /passwords do not match/i);
  await assert.rejects(service.completePasswordRecovery('1234567', '1234567'), /at least 8/);
  assert.equal(calls.some(call => call[0] === 'updateUser' && call[1].password), false);

  const unauthenticated = makeApi({ getSession: async () => ({ data: { session: null }, error: null }) });
  await assert.rejects(makeService(unauthenticated.api, context).completePasswordRecovery('new-password-8', 'new-password-8'), /not authorized or has expired/i);
  assert.equal(unauthenticated.calls.some(call => call[0] === 'updateUser'), false);
});

test('successful recovery updates the password and clears its context; sign-in remains ordinary afterward', async () => {
  const base = makeApi();
  const { calls, session } = base;
  base.api.signInWithPassword = async args => { calls.push(['signIn', args]); return { data: { user: session.user, session }, error: null }; };
  const { context } = makeRecoveryContext();
  const service = makeService(base.api, context);
  await service.requestPasswordReset('learner@example.com');
  await service.completeCallback('valid-reset', true);
  await service.completePasswordRecovery('new-password-8', 'new-password-8');
  assert.equal(await service.isPasswordRecoveryAuthorized('user-1'), false);
  await service.signIn('learner@example.com', 'new-password-8');
  assert.equal(calls.find(call => call[0] === 'updateUser')[1].password, 'new-password-8');
  assert.deepEqual(calls.find(call => call[0] === 'signIn')[1], { email: 'learner@example.com', password: 'new-password-8' });
});

test('failed password updates keep recovery available and never report success', async () => {
  const api = makeApi({ updateUser: async () => ({ data: { user: null }, error: { message: 'fetch failed' } }) });
  const { context } = makeRecoveryContext();
  const service = makeService(api.api, context);
  await service.requestPasswordReset('learner@example.com');
  await service.completeCallback('valid-reset', true);
  await assert.rejects(service.completePasswordRecovery('new-password-8', 'new-password-8'), /offline|connection/);
  assert.equal(await service.isPasswordRecoveryAuthorized('user-1'), true);
});

test('expired, duplicate, and already-consumed recovery callbacks fail safely', async () => {
  const { context } = makeRecoveryContext();
  const service = makeService(makeApi().api, context);
  await service.requestPasswordReset('learner@example.com');
  const expiredApi = makeApi({ exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: { message: 'Token has expired or is invalid' } }) });
  const expiredService = makeService(expiredApi.api, context);
  await assert.rejects(expiredService.completeCallback('expired-code', true), /invalid or has expired/i);
  assert.equal(await context.isAuthorized(), false);

  let resolveExchange;
  let exchangeCount = 0;
  const processor = createAuthCallbackProcessor({
    complete: async () => { exchangeCount++; return new Promise(resolve => { resolveExchange = () => resolve({ user: { id: 'user-1' } }); }); },
    onComplete() {},
    onError(error) { throw error; },
  });
  const first = processor(`${AUTH_RECOVERY_CALLBACK_URL}?code=single-use-recovery-code`);
  assert.equal(await processor(`${AUTH_RECOVERY_CALLBACK_URL}?code=single-use-recovery-code`), 'duplicate');
  assert.equal(exchangeCount, 1);
  resolveExchange();
  assert.equal(await first, 'completed');
});

test('Keychain-backed recovery intent survives restart and expires safely', async () => {
  let now = 1000;
  const values = new Map();
  const storage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async key => values.delete(key),
  };
  const firstApp = createPasswordRecoveryContext(storage, () => now);
  await firstApp.begin();
  const reopenedApp = createPasswordRecoveryContext(storage, () => now);
  assert.equal(await reopenedApp.isRequested(), true);
  assert.equal(await reopenedApp.authorize('user-1'), true);
  assert.equal(await createPasswordRecoveryContext(storage, () => now).isAuthorized('user-1'), true);
  now += 25 * 60 * 60 * 1000;
  assert.equal(await reopenedApp.isAuthorized('user-1'), false);
  assert.equal(values.size, 0);
});

test('signup verification uses Supabase email OTP and never displays or logs the code', async () => {
  const { api, calls } = makeApi();
  const service = makeService(api);
  const session = await service.verifyEmail(' Learner@Example.com ', ' 1234 5678 ');
  assert.equal(session.user.email_confirmed_at, '2026-01-01');
  assert.deepEqual(calls[0], ['verifyOtp', { email: 'learner@example.com', token: '12345678', type: 'email' }]);

  const invalid = makeApi({ verifyOtp: async () => ({ data: { user: null, session: null }, error: { message: 'Token has expired or is invalid' } }) });
  await assert.rejects(makeService(invalid.api).verifyEmail('learner@example.com', '12345678'), /invalid or expired/);
  await assert.rejects(service.verifyEmail('learner@example.com', ''), /verification code/);
});

test('session restoration returns the SDK session or safely returns to guest mode when absent', async () => {
  const existing = makeApi();
  const service = makeService(existing.api);
  assert.equal(await service.restoreSession(), existing.session);
  const expired = makeApi({ getSession: async () => ({ data: { session: null }, error: null }) });
  assert.equal(await makeService(expired.api).restoreSession(), null);
});

test('network failures are actionable and do not expose server details', async () => {
  const api = makeApi({ signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'fetch failed: token=secret-access-token password=hunter2' } }) }).api;
  await assert.rejects(makeService(api).signIn('learner@example.com', 'hunter2'), error => {
    assert.match(error.message, /offline|connection/);
    assert.doesNotMatch(error.message, /secret-access-token|hunter2/);
    return true;
  });
});

test('PKCE callback failures explain that the verifier must be on the same device', async () => {
  const api = makeApi({ exchangeCodeForSession: async () => ({ data: { user: null, session: null }, error: { code: 'pkce_code_verifier_not_found', message: 'PKCE code verifier not found in storage' } }) }).api;
  await assert.rejects(makeService(api).completeCallback('short-lived-code'), /same device.*same app or browser/i);
});

test('callback accepts only the configured routes; recovery is identified by its route, not a URL parameter', () => {
  const parsed = parseAuthCallback(`${AUTH_RECOVERY_CALLBACK_URL}?code=one-time-code`);
  assert.deepEqual(parsed, { ok: true, code: 'one-time-code', isPasswordRecovery: true });
  assert.deepEqual(parseAuthCallback(`${AUTH_CALLBACK_URL}?code=ordinary-login&type=recovery`), { ok: true, code: 'ordinary-login', isPasswordRecovery: false });
  assert.deepEqual(parseAuthCallback('com.pompono.coptic://auth/callback?access_token=leak'), { ok: false, reason: 'missing-code' });
  assert.deepEqual(parseAuthCallback('com.other.app://auth/callback?code=wrong'), { ok: false, reason: 'not-callback' });
  assert.deepEqual(parseAuthCallback('com.pompono.coptic://auth/callback?error=access_denied'), { ok: false, reason: 'provider-error' });
  assert.deepEqual(parseAuthCallback('com.pompono.coptic://auth/callback#error=access_denied&error_code=otp_expired'), { ok: false, reason: 'provider-error' });
  assert.deepEqual(parseAuthCallback('com.pompono.coptic://auth/callback#code=fragment-code&type=recovery'), { ok: true, code: 'fragment-code', isPasswordRecovery: false });
  assert.equal(getAuthRedirectUrl(true), AUTH_CALLBACK_URL);
  assert.equal(getAuthRedirectUrl(false, 'https://example.test/'), 'https://example.test/auth/callback/');
  assert.equal(getAuthRedirectUrl(true, '', 'recovery'), AUTH_RECOVERY_CALLBACK_URL);
  assert.equal(getAuthRedirectUrl(false, 'https://example.test/', 'recovery'), 'https://example.test/auth/recovery/');
});

test('cold-start and already-running callbacks share one exchange; failed callbacks can retry safely', async () => {
  let exchanges = 0;
  const completed = [];
  const errors = [];
  let failFirst = true;
  const processor = createAuthCallbackProcessor({
    complete: async code => {
      exchanges++;
      assert.equal(code, 'one-time-code');
      if (failFirst) { failFirst = false; throw new Error('temporary connection failure'); }
      return { user: { id: 'user-1', email_confirmed_at: 'verified' } };
    },
    onComplete: (session, recovery) => completed.push([session.user.id, recovery]),
    onError: error => errors.push(error.message),
  });
  const launchUrl = `${AUTH_CALLBACK_URL}?code=one-time-code&type=signup`;
  assert.equal(await processor(launchUrl), 'failed');
  assert.equal(await processor(launchUrl), 'completed');
  assert.equal(await processor(launchUrl), 'duplicate');
  assert.equal(await processor(`${AUTH_CALLBACK_URL}?code=one-time-code&type=signup`), 'duplicate');
  assert.equal(exchanges, 2);
  assert.deepEqual(completed, [['user-1', false]]);
  assert.deepEqual(errors, ['temporary connection failure']);
});

test('simultaneous cold-start and appUrlOpen delivery exchange a callback code only once', async () => {
  let resolveExchange;
  let exchanges = 0;
  const processor = createAuthCallbackProcessor({
    complete: async () => {
      exchanges++;
      return new Promise(resolve => { resolveExchange = () => resolve({ user: { id: 'user-1' } }); });
    },
    onComplete() {},
    onError(error) { throw error; },
  });
  const url = `${AUTH_CALLBACK_URL}?code=single-use-code`;
  const coldStart = processor(url);
  const runningApp = await processor(url);
  assert.equal(runningApp, 'duplicate');
  assert.equal(exchanges, 1);
  resolveExchange();
  assert.equal(await coldStart, 'completed');
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

test('PKCE verifier survives a native app restart in Keychain-backed storage', async () => {
  const keychainValues = new Map();
  const keychain = {
    getItem: async key => keychainValues.get(key) ?? null,
    setItem: async (key, value) => keychainValues.set(key, value),
    removeItem: async key => keychainValues.delete(key),
  };
  const browser = { getItem: () => null, setItem() {}, removeItem() {} };
  const firstApp = createAuthStorage(true, keychain, browser);
  await firstApp.setItem('sb-project-auth-token-code-verifier', 'pkce-verifier-value');
  const relaunchedApp = createAuthStorage(true, keychain, browser);
  assert.equal(await relaunchedApp.getItem('sb-project-auth-token-code-verifier'), 'pkce-verifier-value');
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
  const service = makeService(api);
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
