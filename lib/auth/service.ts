export const MINIMUM_PASSWORD_LENGTH = 10;

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
  getSession(): Promise<AuthResult<{ session: AuthSession | null }>>;
  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): { data: { subscription: { unsubscribe(): void } } };
}

export interface AuthServiceOptions {
  api: AuthApi;
  redirectUrl: string;
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

export function createAuthService({ api, redirectUrl }: AuthServiceOptions) {
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
      return data.session;
    },

    async signOut() {
      const { error } = await api.signOut({ scope: 'local' });
      requireNoError(error, 'signOut');
    },

    async requestPasswordReset(email: string) {
      const normalizedEmail = requireValidEmail(email);
      const { error } = await api.resetPasswordForEmail(normalizedEmail, { redirectTo: redirectUrl });
      requireNoError(error, 'passwordReset');
      return 'If an account can receive a reset email at that address, instructions will arrive shortly.';
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

    async updatePassword(password: string) {
      requireValidPassword(password);
      const { error } = await api.updateUser({ password });
      requireNoError(error, 'updatePassword');
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

    async completeCallback(code: string) {
      const { data, error } = await api.exchangeCodeForSession(code);
      requireNoError(error, 'callback');
      return data.session;
    },
  };
}
