'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../AuthProvider';

export default function AccountSection() {
  const router = useRouter();
  const { loading, session, error, clearError, service } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  async function signOut() {
    if (!service) return;
    setBusy(true); setMessage(''); setActionError(''); clearError();
    try {
      await service.signOut();
      setMessage('You are signed out. Your progress remains on this device.');
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'Could not sign out. Try again.');
    } finally { setBusy(false); }
  }

  return <section aria-labelledby="account-title">
    <h2 id="account-title" className="settings-section-title">Account</h2>
    <div className="settings-group account-settings-card">
      {loading ? <p role="status">Checking account…</p> : session ? <>
        <div className="account-summary">
          <strong>{String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Account')}</strong>
          {session.user.email && <span>{session.user.email}</span>}
          <span role="status">{session.user.email_confirmed_at ? 'Email verified' : 'Email not verified'}</span>
        </div>
        <div className="account-actions">
          <button className="ui-secondary" type="button" onClick={() => router.push('/account/')}>Account settings</button>
          <button className="ui-secondary" type="button" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign Out'}</button>
        </div>
      </> : <>
        <p>An optional account gives you email-based access and cloud progress sync. You can continue learning as a guest.</p>
        <p className="settings-note account-sync-note">Cloud sync is optional and stays off until you enable it under Cloud Progress.</p>
        <div className="account-actions">
          <button className="ui-primary" type="button" onClick={() => router.push('/account/?mode=sign-in')}>Sign In</button>
          <button className="ui-secondary" type="button" onClick={() => router.push('/account/?mode=create')}>Create Account</button>
        </div>
      </>}
      {error && <p role="alert" className="account-alert">{error}</p>}
      {actionError && <p role="alert" className="account-alert">{actionError}</p>}
      {message && <p role="status" className="account-alert">{message}</p>}
    </div>
    <p className="settings-note">Accounts are optional. Guest progress and Progress &amp; Backup stay local to this device.</p>
  </section>;
}
