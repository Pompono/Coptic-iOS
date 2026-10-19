export const MINIMUM_PASSWORD_LENGTH = 8;

type AuthError = { message?: string; name?: string; status?: number; code?: string };
type AuthResult<T> = { data: T; error: AuthError | null };

export interface AuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  user: AuthUser;
  expires_at?: number;
}

export interface AuthApi {
  signUp(args: { email: string; password: string; options: { emailRedirectTo: string; data?: Record<string, string> } }): Promise<AuthResult<{ user: AuthUser | null; session: AuthSession | null }>>;
  signInWithPassword(args: { email: string; password: string }): Promise<AuthResult<{ user: AuthUser | null; session: AuthSession | null }>>;
  signOut(args?: { scope: 'local' }): Promise<AuthResult<Record<string, never>>>;
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<AuthResult<Record<string, never>>>;
  resend(args: { type: 'signup'; email: string; options: { emailRedirectTo: string } }): Promise<AuthResult<Record<string, never>>>;
  updateUser(args: { password?: string; email?: string; data?: Record<string, string> }, options?: { emailRedirectTo?: string }): Promise<AuthResult<{ user: AuthUser | null }>>;
  exchangeCodeForSession(code: string): Promise<AuthResult<{ user: AuthUser | null; session: AuthSession | null }>>;
  verifyOtp(args: { email: string; token: string; type: 'email' }): Promise<AuthResult<{ user: AuthUser | null; session: AuthSession | null }>>;
  getSession(): Promise<AuthResult<{ session: AuthSession | null }>>;
  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): { data: { subscription: { unsubscribe(): void } } };
}

export interface AuthServiceOptions {
  api: AuthApi;
  redirectUrl: string;
  recoveryRedirectUrl: string;
  recoveryContext: {
    begin(): Promise<void>;
    authorize(userId: string): Promise<boolean>;
    isRequested(): Promise<boolean>;
    isAuthorized(userId?: string): Promise<boolean>;
    clear(): Promise<void>;
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

function failureMessage(error: AuthError | null, operation: string): string {
  if (!error) return '';
  const message = (error.message ?? '').toLowerCase();
  const code = (error.code ?? '').toLowerCase();
  if (/fetch|network|failed to connect|timeout|offline/u.test(message) || error.name === 'AuthRetryableFetchError') {
    return 'You appear to be offline or the service could not be reached. Check your connection and try again.';
  }
  if (/pkce|code verifier|flow state/u.test(message) || code.includes('code_verifier')) {
    return 'This email link cannot be completed in this app session. Open it on the same device and in the same app or browser where you started, or request a new verification code.';
  }
  if (operation === 'verification' && /otp|token|expired|invalid/u.test(`${message} ${code}`)) {
    return 'That verification code is invalid or expired. Request a new verification email and try again.';
  }
  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) {
    return 'Email or password is incorrect. If you need help, use Forgot password.';
  }
  if (message.includes('user already registered') || code.includes('user_already_exists')) {
    return 'We could not create an account with those details. Try signing in or resetting your password.';
  }
  if (message.includes('email not confirmed')) return 'Check your email and confirm your address before signing in.';
  if (message.includes('password should be at least') || message.includes('weak_password')) {
    return `Choose a password with at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }
  if (operation === 'callback') return 'This sign-in link is invalid or has expired. Request a new email and try again.';
  if (operation === 'session') return 'Your session could not be restored. Check your connection, then sign in again.';
  if (error.status && error.status >= 500) return 'The account service is temporarily unavailable. Try again later.';
  return 'The request could not be completed. Check your details and try again.';
}

function requireNoError(error: AuthError | null, operation: string): void {
  if (error) throw new Error(failureMessage(error, operation));
}

function requireValidEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!validEmail(normalized)) throw new Error('Enter a valid email address.');
  return normalized;
}

function requireValidPassword(password: string): void {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`Choose a password with at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }
}

export function createAuthService({ api, redirectUrl, recoveryRedirectUrl, recoveryContext }: AuthServiceOptions) {
  return {
    async register(email: string, password: string, displayName = '') {
      const normalizedEmail = requireValidEmail(email);
      requireValidPassword(password);
      const name = displayName.trim().slice(0, 60);
      const { data, error } = await api.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: redirectUrl, ...(name ? { data: { display_name: name } } : {}) },
      });
      requireNoError(error, 'register');
      return { needsVerification: !data.session, email: normalizedEmail };
    },

    async signIn(email: string, password: string) {
      const normalizedEmail = requireValidEmail(email);
      if (!password) throw new Error('Enter your password.');
      const { data, error } = await api.signInWithPassword({ email: normalizedEmail, password });
      requireNoError(error, 'signIn');
      await recoveryContext.clear();
      return data.session;
    },

    async signOut() {
      const { error } = await api.signOut({ scope: 'local' });
      requireNoError(error, 'signOut');
      await recoveryContext.clear();
    },

    async requestPasswordReset(email: string) {
      const normalizedEmail = requireValidEmail(email);
      await recoveryContext.begin();
      try {
        const { error } = await api.resetPasswordForEmail(normalizedEmail, { redirectTo: recoveryRedirectUrl });
        requireNoError(error, 'passwordReset');
        return 'If an account can receive a reset email at that address, instructions will arrive shortly.';
      } catch (failure) {
        await recoveryContext.clear();
        throw failure;
      }
    },

    async resendVerification(email: string) {
      const normalizedEmail = requireValidEmail(email);
      const { error } = await api.resend({
        type: 'signup',
        email: normalizedEmail,
        options: { emailRedirectTo: redirectUrl },
      });
      requireNoError(error, 'verification');
      return 'If that address has a pending verification, a new email will arrive shortly.';
    },

    async verifyEmail(email: string, token: string) {
      const normalizedEmail = requireValidEmail(email);
      const normalizedToken = token.trim().replace(/\s+/gu, '');
      if (!normalizedToken || normalizedToken.length > 32 || !/^\d+$/u.test(normalizedToken)) {
        throw new Error('Enter the verification code from your email.');
      }
      const { data, error } = await api.verifyOtp({ email: normalizedEmail, token: normalizedToken, type: 'email' });
      requireNoError(error, 'verification');
      if (!data.session || !data.user?.email_confirmed_at) {
        throw new Error('Email verification could not be completed. Request a new verification email and try again.');
      }
      return data.session;
    },

    async updatePassword(password: string) {
      requireValidPassword(password);
      const { error } = await api.updateUser({ password });
      requireNoError(error, 'updatePassword');
    },

    async completePasswordRecovery(password: string, confirmation: string) {
      requireValidPassword(password);
      if (password !== confirmation) throw new Error('The passwords do not match. Enter the same password in both fields.');
      const { data: sessionData, error: sessionError } = await api.getSession();
      requireNoError(sessionError, 'session');
      const userId = sessionData.session?.user.id;
      if (!userId || !(await recoveryContext.isAuthorized(userId))) {
        throw new Error('This password reset is not authorized or has expired. Request a new reset email and open it on this device.');
      }
      const { data, error } = await api.updateUser({ password });
      requireNoError(error, 'updatePassword');
      if (data.user?.id !== userId) throw new Error('The account service did not confirm the password change. Try again.');
      await recoveryContext.clear();
    },

    async cancelPasswordRecovery() {
      await recoveryContext.clear();
    },

    async isPasswordRecoveryAuthorized(userId?: string) {
      return recoveryContext.isAuthorized(userId);
    },

    async updateDisplayName(displayName: string) {
      const name = displayName.trim().slice(0, 60);
      const { error } = await api.updateUser({ data: { display_name: name } });
      requireNoError(error, 'updateProfile');
    },

    async changeEmail(email: string) {
      const normalizedEmail = requireValidEmail(email);
      const { error } = await api.updateUser({ email: normalizedEmail }, { emailRedirectTo: redirectUrl });
      requireNoError(error, 'updateEmail');
      return 'If this email can be changed, check your current and new inboxes for verification instructions.';
    },

    async restoreSession() {
      const { data, error } = await api.getSession();
      requireNoError(error, 'session');
      return data.session;
    },

    async completeCallback(code: string, isPasswordRecovery = false) {
      if (isPasswordRecovery && !(await recoveryContext.isRequested())) {
        throw new Error('This password-reset link was not requested from this app session. Request a new reset email on this device.');
      }
      const { data, error } = await api.exchangeCodeForSession(code);
      requireNoError(error, 'callback');
      if (isPasswordRecovery) {
        const userId = data.session?.user.id;
        if (!userId || !(await recoveryContext.authorize(userId))) {
          await api.signOut({ scope: 'local' });
          await recoveryContext.clear();
          throw new Error('This password-reset request expired. Request a new reset email and try again.');
        }
      }
      return data.session;
    },
  };
}
