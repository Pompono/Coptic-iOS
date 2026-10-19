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

      if (!cloud) {
        if (!Object.keys(local).length) { setMessage('Cloud sync is on. Progress will sync after you start learning.'); return; }
        setPending({ kind: 'upload', local, cloud: null });
        setMessage('Choose whether to upload the progress already on this device.');
        return;
      }

      if (!base) {
        if (sameProgressRecords(local, cloud.records)) {
          saveSyncBase(userId, cloud.revision, cloud.records);
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
        if ('conflict' in written) {
          setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
          setMessage('Cloud progress changed on another device. Choose which copy to keep.');
        } else {
          saveSyncBase(userId, written.revision, local);
          setMessage('Your progress is synced.');
        }
      } else if (!localChanged && cloudChanged && removesProgressRecords(base.records, cloud.records)) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('The cloud copy is missing progress that was in the last sync. Review before replacing either copy.');
      } else if (!localChanged && cloudChanged) {
        const latestCloud = await fetchProgressSnapshot(client, userId);
        const latestLocal = makeBackup().records;
        if (latestCloud?.revision !== cloud.revision || !sameProgressRecords(latestLocal, base.records)) {
          setPending({ kind: 'conflict', local: latestLocal, cloud: latestCloud });
          setMessage('Progress changed while sync was running. Review both copies before continuing.');
        } else {
          saveSyncBase(userId, latestCloud.revision, latestCloud.records);
          installCloudProgress(latestCloud.records);
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

  useEffect(() => {
    if (!enabled || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => void synchronize(), 1200); };
    window.addEventListener('coptic-progress-change', schedule);
    window.addEventListener('online', schedule);
    window.addEventListener('focus', schedule);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('coptic-progress-change', schedule);
      window.removeEventListener('online', schedule);
      window.removeEventListener('focus', schedule);
    };
  }, [enabled, userId, synchronize]);

  async function choose(kind: 'upload' | 'download') {
    if (!userId || !pending) return;
    setBusy(true); setError(''); setPending(null);
    try {
      const client = await getSupabaseClient();
      const cloud = await fetchProgressSnapshot(client, userId);
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
        if ('conflict' in written) {
          setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
          setMessage('Cloud progress changed on another device. Review both copies before continuing.');
        } else {
          saveSyncBase(userId, written.revision, local);
          setMessage('This device’s progress is synced to your account.');
        }
      } else if (cloud) {
        saveSyncBase(userId, cloud.revision, cloud.records);
        installCloudProgress(cloud.records);
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
