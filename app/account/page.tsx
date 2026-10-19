'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '../PageHeader';
import { useAuth } from '../AuthProvider';
import { MINIMUM_PASSWORD_LENGTH } from '@/lib/auth/service';
import styles from './account.module.css';

type Mode = 'sign-in' | 'create' | 'forgot' | 'verification' | 'reset' | 'settings';

export default function AccountPage() {
  const router = useRouter();
  const { configured, loading, session, error: authError, clearError, recoveryPending, service, retrySession } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('mode');
    if (recoveryPending) setMode('reset');
    else if (requested === 'create' || requested === 'forgot') setMode(requested);
    else if (requested === 'settings' && session) {
      setDisplayName(String(session.user.user_metadata?.display_name ?? ''));
      setMode('settings');
    }
    else if (requested === 'sign-in') setMode('sign-in');
  }, [recoveryPending, session]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(() => {
    const keepFieldVisible = (event: FocusEvent) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement) || ['checkbox', 'radio', 'button'].includes(field.type)) return;
      window.setTimeout(() => {
        const viewport = window.visualViewport;
        const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 24;
        const bounds = field.getBoundingClientRect();
        if (bounds.bottom > visibleBottom) {
          window.scrollBy({ top: bounds.bottom - visibleBottom + 12, behavior: 'smooth' });
        }
      }, 300);
    };
    document.addEventListener('focusin', keepFieldVisible);
    return () => document.removeEventListener('focusin', keepFieldVisible);
  }, []);

  function changeMode(next: Mode) {
    setMode(next); setMessage(''); setError(''); clearError();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service) { setError('Account sign-in is not configured in this build. You can keep using Coptic as a guest.'); return; }
    setBusy(true); setError(''); setMessage(''); clearError();
    try {
      if (mode === 'create') {
        const result = await service.register(email, password, displayName);
        setEmail(result.email);
        setMessage(result.needsVerification
          ? 'Check your inbox for a verification link. Open it on this device to verify your email.'
          : 'Your account is ready.');
        setMode(result.needsVerification ? 'verification' : 'settings');
      } else if (mode === 'sign-in') {
        await service.signIn(email, password);
        router.replace('/settings/');
      } else if (mode === 'forgot') {
        setMessage(await service.requestPasswordReset(email));
      } else if (mode === 'verification') {
        setMessage(await service.resendVerification(email));
        setResendSeconds(60);
      } else if (mode === 'reset') {
        await service.updatePassword(password);
        setMessage('Password updated. Your account is ready to use.');
        changeMode('settings');
      } else if (mode === 'settings') {
        if (displayName.trim() !== String(session?.user.user_metadata?.display_name ?? '')) {
          await service.updateDisplayName(displayName);
        }
        if (newEmail.trim()) setMessage(await service.changeEmail(newEmail));
        else setMessage('Account settings saved.');
        setNewEmail('');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request could not be completed. Try again.');
    } finally { setBusy(false); }
  }

  async function signOut() {
    if (!service) return;
    setBusy(true); setError(''); setMessage('');
    try { await service.signOut(); setMessage('You are signed out. Your learning progress remains on this device.'); setMode('sign-in'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign out. Try again.'); }
    finally { setBusy(false); }
  }

  const formHeading = mode === 'sign-in' ? 'Sign in' : mode === 'create' ? 'Create account'
    : mode === 'forgot' ? 'Reset password' : mode === 'verification' ? 'Verify your email'
      : mode === 'reset' ? 'Choose a new password' : 'Account settings';

  return <main className={`app-page ${styles.page}`}>
    <PageHeader title="Account" icon="settings" />
    <section className={styles.card} aria-labelledby="account-heading">
      <h1 id="account-heading" className={styles.sectionTitle}>{formHeading}</h1>
      {!configured ? <>
        <p className={styles.copy}>Optional accounts use email and password. Account access is not configured in this build; you can continue using all learning features as a guest.</p>
        <p className={styles.copy}>Your progress stays on this device. Cloud progress syncing is coming later and does not happen when you sign in or out.</p>
      </> : loading ? <p className={styles.status} role="status">Checking account…</p> : session && mode !== 'reset' ? <>
        <p className={styles.copy}>Signed in as <span className={styles.email}>{session.user.email}</span></p>
        <p className={styles.status} role="status">{session.user.email_confirmed_at ? 'Email verified' : 'Email verification is pending'}</p>
        {!session.user.email_confirmed_at && <button className={styles.linkButton} type="button" disabled={busy || resendSeconds > 0} onClick={() => { setEmail(session.user.email ?? ''); changeMode('verification'); }}>
          {resendSeconds ? `Try again in ${resendSeconds}s` : 'Resend verification email'}
        </button>}
        {mode === 'settings' && <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>Display name (optional)
            <input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={60} autoComplete="nickname" />
          </label>
          <label className={styles.field}>Change email (optional)
            <input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} autoComplete="email" inputMode="email" />
          </label>
          <p className={styles.copy}>A verified email change requires confirmation from the inboxes Supabase requests.</p>
          <button className={styles.button} type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save account settings'}</button>
        </form>}
        <div className={styles.row}>
          {mode !== 'settings' && <button className={styles.linkButton} type="button" onClick={() => { setDisplayName(String(session.user.user_metadata?.display_name ?? '')); changeMode('settings'); }}>Account settings</button>}
          <button className={styles.linkButton} type="button" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign Out'}</button>
        </div>
      </> : configured && !session && mode === 'verification' ? <>
        <p className={styles.copy}>We sent verification instructions to <span className={styles.email}>{email}</span>. Open the link on this device to finish verification.</p>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>Email
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
          </label>
          <button className={styles.button} type="submit" disabled={busy || resendSeconds > 0}>{busy ? 'Sending…' : resendSeconds ? `Try again in ${resendSeconds}s` : 'Resend verification email'}</button>
        </form>
      </> : configured && mode === 'reset' ? <>
        <p className={styles.copy}>{recoveryPending ? 'Choose a new password for your account.' : 'Open the latest password-reset email on this device. If the link expired, request another one.'}</p>
        {recoveryPending && <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>New password
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={MINIMUM_PASSWORD_LENGTH} required />
          </label>
          <p className={styles.copy}>Use at least {MINIMUM_PASSWORD_LENGTH} characters.</p>
          <button className={styles.button} type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        </form>}
        <button className={styles.linkButton} type="button" onClick={() => changeMode('forgot')}>Request another reset email</button>
      </> : configured ? <>
        <p className={styles.copy}>{mode === 'create'
          ? 'Create an optional account. You can keep learning as a guest; account sign-in does not sync or change your progress.'
          : mode === 'forgot' ? 'Enter your email and we will send password-reset instructions if the address can receive them.'
            : mode === 'verification' ? 'Open the verification email on this device. We will not change local learning progress.'
              : 'Sign in to your account. Your learning progress stays on this device.'}</p>
        <form className={styles.form} onSubmit={submit}>
          {mode === 'create' && <label className={styles.field}>Display name (optional)
            <input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={60} autoComplete="nickname" />
          </label>}
          <label className={styles.field}>Email
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
          </label>
          {(mode === 'create' || mode === 'sign-in') && <label className={styles.field}>Password
            <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} minLength={mode === 'create' ? MINIMUM_PASSWORD_LENGTH : undefined} required />
          </label>}
          {mode === 'create' && <p className={styles.copy}>Use at least {MINIMUM_PASSWORD_LENGTH} characters.</p>}
          <button className={styles.button} type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'create' ? 'Create Account' : mode === 'forgot' ? 'Send reset instructions' : mode === 'verification' ? 'Resend verification email' : 'Sign In'}</button>
        </form>
        {mode === 'sign-in' && <button className={styles.linkButton} type="button" onClick={() => changeMode('forgot')}>Forgot password?</button>}
        <div className={styles.row}>
          {mode !== 'sign-in' && <button className={styles.linkButton} type="button" onClick={() => changeMode('sign-in')}>Sign In</button>}
          {mode !== 'create' && <button className={styles.linkButton} type="button" onClick={() => changeMode('create')}>Create Account</button>}
        </div>
      </> : null}
      {authError && <p className={styles.alert} role="alert">{authError}</p>}
      {error && <p className={styles.alert} role="alert">{error}</p>}
      {message && <p className={styles.alert} role="status">{message}</p>}
      {configured && error && /offline|connection|service could not be reached/iu.test(error) && <button className={styles.linkButton} type="button" disabled={loading} onClick={() => void retrySession()}>Retry session check</button>}
      <p className={styles.copy}>Accounts do not include cloud progress syncing yet. Sign in and sign out leave your local learning progress and backup files unchanged.</p>
    </section>
    <button className="ui-secondary" type="button" onClick={() => router.push('/settings/')}>Back to Settings</button>
  </main>;
}
