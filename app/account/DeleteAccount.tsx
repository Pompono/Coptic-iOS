'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../AuthProvider';
import { getDeletionState } from '@/lib/auth/client';
import { checkAccountDeletion, deleteCurrentAccount, deletionRequest } from '@/lib/auth/deletion';
import styles from './account.module.css';

export default function DeleteAccount() {
  const { session, configured, recoveryPending } = useAuth();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function readiness() {
    setChecking(true);
    try {
      setPending(Boolean(await (await getDeletionState()).read()));
      setAvailable(await deletionRequest('ready') === 'available');
    } catch { setAvailable(false); }
    finally { setChecking(false); }
  }

  useEffect(() => {
    if (!configured) return;
    if (session?.user.id) void readiness();
    else void getDeletionState().then(state => state.read()).then(value => setPending(Boolean(value)))
      .catch(() => setError('Secure deletion status could not be read. Reopen the app and try again.'))
      .finally(() => setChecking(false));
  }, [configured, session?.user.id]);
  useEffect(() => {
    const finished = () => {
      setPending(false); setOpen(false);
      setMessage('Your account and its cloud progress were permanently deleted. Your local learning progress is still on this device.');
    };
    window.addEventListener('coptic-account-deletion-finished', finished);
    return () => window.removeEventListener('coptic-account-deletion-finished', finished);
  }, []);

  async function act(checkOnly: boolean) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (checkOnly) {
        const result = await checkAccountDeletion();
        if (result === 'deleted') { setMessage('Your account and its cloud progress were permanently deleted. Your local learning progress is still on this device.'); setPending(false); setOpen(false); }
        else setMessage(result === 'processing'
          ? 'Deletion is processing. Wait two minutes, then check again. Sync remains paused.'
          : 'Deletion is not complete. Sign in if needed and retry with your current password. Your local progress is safe; sync remains paused.');
      } else {
        if (!session || confirmation !== 'DELETE' || !password) return;
        await deleteCurrentAccount(session.user.id, password);
        setMessage('Your account and its cloud progress were permanently deleted. Your local learning progress is still on this device.');
        setPending(false); setOpen(false);
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Deletion could not be confirmed. Check deletion status.');
      setPending(Boolean(await (await getDeletionState()).read()));
    } finally { setPassword(''); setConfirmation(''); setBusy(false); inFlight.current = false; }
  }

  function submit(event: FormEvent) { event.preventDefault(); void act(false); }
  if (!configured || (!session && !pending && !message && !error)) return null;
  return <section className={styles.deletion} aria-label="Delete account">
    {session && !open && <>
      <button type="button" className={`${styles.linkButton} ${styles.signOut}`} disabled={checking || !available || recoveryPending || busy} onClick={() => { setOpen(true); setError(''); }}>Delete Account</button>
      {(!available || checking) && <p className={styles.copy}>{checking ? 'Checking deletion availability…' : 'Account deletion is currently unavailable. Your account has not been deleted.'}</p>}
      {!available && !checking && <button type="button" className={styles.linkButton} onClick={() => void readiness()}>Check availability again</button>}
    </>}
    {open && session && <form className={styles.form} onSubmit={submit} aria-label="Confirm account deletion">
      <h2>Delete your account permanently?</h2>
      <p className={styles.copy}>Your account will be permanently deleted. You will no longer be able to sign in with this account. Its cloud-synchronized progress will be deleted. Support cannot undo deletion.</p>
      <p className={styles.copy}>Your lessons, XP, vocabulary and reading progress on this device will stay. Progress may remain locally on other devices, but those devices can no longer synchronize through this account.</p>
      <label className={styles.field}>Current password
        <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
      </label>
      <label className={styles.field}>Type DELETE to confirm
        <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} required disabled={busy} />
      </label>
      <button type="submit" className={`${styles.button} ${styles.destructiveButton}`} disabled={busy || !available || !password || confirmation !== 'DELETE'}>{busy ? 'Checking deletion…' : 'Permanently Delete Account'}</button>
      <button type="button" className={styles.linkButton} disabled={busy} onClick={() => { setOpen(false); setPassword(''); setConfirmation(''); }}>{pending ? 'Close confirmation' : 'Cancel'}</button>
    </form>}
    {pending && <>
      <p className={styles.copy}>A deletion request needs confirmation. Closing this screen does not cancel a submitted deletion. Cloud sync is paused. You can keep learning offline while resolving it.</p>
      <button type="button" className={styles.linkButton} disabled={busy} onClick={() => void act(true)}>Check deletion status</button>
    </>}
    {error && <p className={styles.alert} role="alert">{error}</p>}
    {message && <p className={styles.alert} role="status">{message}</p>}
  </section>;
}
