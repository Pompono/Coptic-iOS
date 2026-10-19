'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient, supabaseAuthConfigured } from '@/lib/auth/client';
import { useAuth } from '../AuthProvider';
import { makeBackup } from '@/lib/progressStorage';
import {
  fetchProgressSnapshot, installCloudProgress, PROGRESS_SYNC_OPT_IN_KEY,
  readSyncBase, removesProgressRecords, sameProgressRecords, saveSyncBase, writeProgressSnapshot,
  type ProgressSnapshot,
} from '@/lib/progressSync';
import type { Records } from '@/lib/progressStorage';

type PendingChoice = { kind: 'upload' | 'download' | 'conflict'; local: Records; cloud: ProgressSnapshot | null };
const LAST_USER_KEY = 'coptic-progress-sync-last-user:v1';

export default function ProgressSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingChoice | null>(null);

  const synchronize = useCallback(async () => {
    if (!userId) return;
    setBusy(true); setError(''); setPending(null);
    try {
      if (localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
      const client = await getSupabaseClient();
      const local = makeBackup().records;
      const [base, cloud] = await Promise.all([
        Promise.resolve(readSyncBase(userId)),
        fetchProgressSnapshot(client, userId),
      ]);
      const active = await client.auth.getSession();
      if (active.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
      const previousUser = localStorage.getItem(LAST_USER_KEY);
      if (previousUser && previousUser !== userId) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('This device was last synced with another account. Review both copies before continuing.');
        return;
      }

      if (!cloud) {
        if (!Object.keys(local).length) { setMessage('Cloud sync is on. Progress will sync after you start learning.'); return; }
        setPending({ kind: 'upload', local, cloud: null });
        setMessage('Choose whether to upload the progress already on this device.');
        return;
      }

      if (!base) {
        if (sameProgressRecords(local, cloud.records)) {
          saveSyncBase(userId, cloud.revision, cloud.records);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('Your progress is synced.');
        } else if (!Object.keys(local).length) {
          setPending({ kind: 'download', local, cloud });
          setMessage('Progress is available in your cloud account. Review before downloading it to this device.');
        } else {
          setPending({ kind: 'conflict', local, cloud });
          setMessage('This device and your cloud account have different progress. Choose which copy to keep.');
        }
        return;
      }

      const localChanged = !sameProgressRecords(local, base.records);
      const cloudChanged = !sameProgressRecords(cloud.records, base.records);
      if (!localChanged && !cloudChanged) {
        if (base.revision !== cloud.revision) saveSyncBase(userId, cloud.revision, cloud.records);
        setMessage('Your progress is synced.');
      } else if (localChanged && !cloudChanged && removesProgressRecords(base.records, local)) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('This device is missing progress that was in the last sync. Review before replacing either copy.');
      } else if (localChanged && !cloudChanged) {
        const written = await writeProgressSnapshot(client, cloud.revision, local);
        const afterWrite = await client.auth.getSession();
        if (afterWrite.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
        if ('conflict' in written) {
          setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
          setMessage('Cloud progress changed on another device. Choose which copy to keep.');
        } else {
          saveSyncBase(userId, written.revision, local);
          localStorage.setItem(LAST_USER_KEY, userId);
          if (sameProgressRecords(makeBackup().records, local)) setMessage('Your progress is synced.');
          else {
            setMessage('More progress changed during upload. The uploaded copy is safe; the newer local progress is still pending sync.');
            window.dispatchEvent(new Event('coptic-progress-change'));
          }
        }
      } else if (!localChanged && cloudChanged && removesProgressRecords(base.records, cloud.records)) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('The cloud copy is missing progress that was in the last sync. Review before replacing either copy.');
      } else if (!localChanged && cloudChanged) {
        const latestCloud = await fetchProgressSnapshot(client, userId);
        const currentSession = await client.auth.getSession();
        if (currentSession.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
        const latestLocal = makeBackup().records;
        if (latestCloud?.revision !== cloud.revision || !sameProgressRecords(latestLocal, base.records)) {
          setPending({ kind: 'conflict', local: latestLocal, cloud: latestCloud });
          setMessage('Progress changed while sync was running. Review both copies before continuing.');
        } else {
          installCloudProgress(latestCloud.records);
          saveSyncBase(userId, latestCloud.revision, latestCloud.records);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('New cloud progress was downloaded. Your previous device copy is available in Recovery copy.');
        }
      } else {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('Both this device and the cloud changed since the last sync. Choose which copy to keep.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Cloud sync failed. Your local progress is unchanged.');
    } finally { setBusy(false); }
  }, [userId]);

  useEffect(() => {
    setReady(false); setPending(null); setMessage(''); setError('');
    if (!userId) { setEnabled(false); setReady(true); return; }
    let optedIn = false;
    try { optedIn = localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) === userId; }
    catch { setError('Device storage is unavailable. Cloud sync cannot be enabled safely.'); }
    setEnabled(optedIn); setReady(true);
    if (optedIn) void synchronize();
  }, [userId, synchronize]);

  async function choose(kind: 'upload' | 'download') {
    if (!userId || !pending) return;
    setBusy(true); setError(''); setPending(null);
    try {
      const client = await getSupabaseClient();
      const cloud = await fetchProgressSnapshot(client, userId);
      const currentSession = await client.auth.getSession();
      if (currentSession.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
      const local = makeBackup().records;
      if (!sameProgressRecords(local, pending.local)) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('This device changed while you were reviewing. Review the latest copies before continuing.');
        return;
      }
      if ((cloud?.revision ?? 0) !== (pending.cloud?.revision ?? 0)) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('Cloud progress changed while you were reviewing. Review the latest version before continuing.');
        return;
      }
      if (kind === 'upload') {
        const written = await writeProgressSnapshot(client, cloud?.revision ?? 0, local);
        const afterWrite = await client.auth.getSession();
        if (afterWrite.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
        if ('conflict' in written) {
          setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
          setMessage('Cloud progress changed on another device. Review both copies before continuing.');
        } else {
          saveSyncBase(userId, written.revision, local);
          localStorage.setItem(LAST_USER_KEY, userId);
          if (sameProgressRecords(makeBackup().records, local)) setMessage('This device’s progress is synced to your account.');
          else {
            setMessage('More progress changed during upload. The uploaded copy is safe; the newer local progress is still pending sync.');
            window.dispatchEvent(new Event('coptic-progress-change'));
          }
        }
      } else if (cloud) {
        const beforeInstall = await client.auth.getSession();
        if (beforeInstall.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
        const currentLocal = makeBackup().records;
        if (!sameProgressRecords(currentLocal, pending.local)) {
          setPending({ kind: 'conflict', local: currentLocal, cloud });
          setMessage('This device changed while you were reviewing. Review the latest copies before continuing.');
          return;
        }
        installCloudProgress(cloud.records);
        saveSyncBase(userId, cloud.revision, cloud.records);
        localStorage.setItem(LAST_USER_KEY, userId);
        setMessage('Cloud progress downloaded. Your previous device copy is available in Recovery copy.');
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The selection could not be synced. Your local progress is unchanged.');
    } finally { setBusy(false); }
  }

  function toggle(enabledNext: boolean) {
    setError(''); setMessage(''); setPending(null);
    if (!enabledNext) {
      try {
        localStorage.removeItem(PROGRESS_SYNC_OPT_IN_KEY);
        window.dispatchEvent(new Event('coptic-progress-sync-optout'));
        setEnabled(false);
        setMessage('Cloud sync is off. Progress already synced to your account remains there.');
      } catch { setError('Device storage is unavailable. Cloud sync could not be turned off on this device.'); }
      return;
    }
    try {
      localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
      setEnabled(true);
      setMessage('Cloud sync is on. Checking your account progress…');
      void synchronize();
    } catch { setError('Device storage is unavailable. Cloud sync was not enabled.'); }
  }

  if (!supabaseAuthConfigured) return null;
  return <section aria-labelledby="progress-sync-title">
    <h2 id="progress-sync-title" className="settings-section-title">Cloud Progress</h2>
    <div className="settings-group">
      {!userId ? <p>Sign in to enable optional cloud progress sync. Learning stays on this device while signed out.</p> : <>
        <p>Sync lesson completion, practice results, vocabulary reviews, and saved reader passages or drafts across devices. Sync starts only after you turn it on. Offline learning continues locally.</p>
        <div className="settings-row">
          <label htmlFor="progress-sync-switch">Enable Cloud Sync</label>
          <input id="progress-sync-switch" type="checkbox" className="ui-switch" role="switch" checked={enabled} disabled={!ready || busy} onChange={event => toggle(event.target.checked)} />
        </div>
        {enabled && <div className="settings-row">
          <button type="button" className="ui-secondary" disabled={busy} onClick={() => void synchronize()}>{busy ? 'Syncing…' : 'Sync now'}</button>
        </div>}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {pending && <div className="ui-panel" role="region" aria-label="Review cloud progress" style={{ padding: 16 }}>
          <h3>{pending.kind === 'upload' ? 'Upload this device’s progress?' : pending.kind === 'download' ? 'Download cloud progress?' : 'Choose a progress copy'}</h3>
          <p>{pending.kind === 'upload'
            ? 'This sends the validated learning records on this device to your signed-in account.'
            : pending.kind === 'download'
              ? 'This replaces progress on this device with the cloud copy. A recovery copy of this device’s progress will be saved first.'
              : 'Both copies changed since the last sync. Keeping one replaces the other copy. A recovery copy is saved before a cloud download.'}</p>
          {pending.kind !== 'upload' && <button type="button" className="ui-primary" disabled={busy} onClick={() => void choose('download')}>Use cloud progress on this device</button>}{' '}
          {pending.kind !== 'download' && <button type="button" className="ui-secondary" disabled={busy} onClick={() => void choose('upload')}>{pending.kind === 'conflict' ? 'Replace cloud with this device' : 'Upload this device’s progress'}</button>}{' '}
          <button type="button" className="ui-secondary" disabled={busy} onClick={() => { setPending(null); setMessage('No progress was changed. Sync is paused until you choose or review again.'); }}>Cancel</button>
        </div>}
      </>}
    </div>
    <p className="settings-note">Your account is identified by its signed-in user ID. Only that account can read or change its cloud snapshot. Turning sync off stops future syncs but does not delete the cloud copy.</p>
  </section>;
}
