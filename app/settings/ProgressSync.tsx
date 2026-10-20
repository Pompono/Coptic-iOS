'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient, supabaseAuthConfigured } from '@/lib/auth/client';
import { useAuth } from '../AuthProvider';
import { makeBackup } from '@/lib/progressStorage';
import {
  fetchProgressSnapshot, installCloudProgress, PROGRESS_SYNC_OPT_IN_KEY, progressSyncErrorMessage,
  readSyncBase, removesProgressRecords, sameProgressRecords, saveSyncBase, writeProgressSnapshot,
  type ProgressSnapshot,
} from '@/lib/progressSync';
import type { Records } from '@/lib/progressStorage';
import { reconcileProgressRecords, summarizeProgress } from '@/lib/progressReconciliation';
import { acquireProgressSyncLock } from '@/lib/progressSyncLock';

function progressComparison(local: Records, cloud: Records | null) {
  if (!cloud) return null;
  const device = summarizeProgress(local);
  const remote = summarizeProgress(cloud);
  const order = (a: typeof device, b: typeof remote) => a.position - b.position || a.lessons - b.lessons || a.steps - b.steps || a.xp - b.xp;
  const comparison = order(device, remote);
  const recommendation = comparison > 0 ? 'The device copy is more advanced.' : comparison < 0 ? 'The cloud copy is more advanced.' : 'Neither copy is clearly more advanced.';
  const format = (name: string, value: typeof device) => `${name}: ${value.lessons} completed lessons, through ${value.through}, ${value.steps} completed steps, ${value.xp} XP.`;
  return { summary: `${format('This device', device)} ${format('Cloud', remote)} ${recommendation}`, recommended: comparison > 0 ? 'device' : comparison < 0 ? 'cloud' : null };
}

type PendingChoice = { kind: 'upload' | 'download' | 'conflict'; local: Records; cloud: ProgressSnapshot | null };
const LAST_USER_KEY = 'coptic-progress-sync-last-user:v1';

export default function ProgressSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingChoice | null>(null);
  const [online, setOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const comparison = pending?.kind === 'conflict' ? progressComparison(pending.local, pending.cloud?.records ?? null) : null;

  const synchronize = useCallback(async () => {
    if (!userId || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError(''); setPending(null);
    const releaseSyncLock = await acquireProgressSyncLock();
    try {
      if (controller.signal.aborted) return;
      const client = await getSupabaseClient();
      const local = makeBackup().records;
      const [base, cloud] = await Promise.all([
        Promise.resolve(readSyncBase(userId)),
        fetchProgressSnapshot(client, userId, controller.signal),
      ]);
      if (cloud?.updatedAt) setLastSynced(cloud.updatedAt);
      if (controller.signal.aborted) return;
      const active = await client.auth.getSession();
      if (active.data.session?.user.id !== userId) return;
      const previousUser = localStorage.getItem(LAST_USER_KEY);
      if (previousUser && previousUser !== userId) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('This device was last synced with another account. Review both copies before continuing.');
        return;
      }

      // A removed legacy opt-in marker means this account previously had sync
      // disabled. If either copy moved since its saved baseline, require an
      // explicit choice before uploading or replacing device progress.
      if (base && localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId
        && (!sameProgressRecords(local, base.records) || !sameProgressRecords(cloud?.records ?? {}, base.records))) {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('Cloud sync was previously off for this account. Review both copies before resuming.');
        return;
      }

      if (!cloud) {
        if (!Object.keys(local).length) { setMessage('Ready to sync when you start learning.'); return; }
        const written = await writeProgressSnapshot(client, 0, local, controller.signal);
        if (controller.signal.aborted) return;
        const latestSession = await client.auth.getSession();
        if (latestSession.data.session?.user.id !== userId) return;
        if ('conflict' in written) { setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot }); setMessage('Cloud progress appeared on another device. Review both copies before continuing.'); }
        else { saveSyncBase(userId, written.revision, local); localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId); localStorage.setItem(LAST_USER_KEY, userId); if (written.updatedAt) setLastSynced(written.updatedAt); setMessage(sameProgressRecords(makeBackup().records, local) ? 'Synced' : 'Waiting to upload'); }
        return;
      }

      if (sameProgressRecords(local, cloud.records)) {
        saveSyncBase(userId, cloud.revision, cloud.records);
        localStorage.setItem(LAST_USER_KEY, userId);
        setMessage('Your progress is synced.');
        return;
      }

      if (!base) {
        if (sameProgressRecords(local, cloud.records)) {
          saveSyncBase(userId, cloud.revision, cloud.records);
          localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('Your progress is synced.');
        } else if (!Object.keys(local).length) {
          const latestCloud = await fetchProgressSnapshot(client, userId, controller.signal);
          if (controller.signal.aborted) return;
          const latestSession = await client.auth.getSession();
          if (latestSession.data.session?.user.id !== userId || latestCloud?.revision !== cloud.revision || Object.keys(makeBackup().records).length) return;
          installCloudProgress(latestCloud.records);
          saveSyncBase(userId, latestCloud.revision, latestCloud.records);
          localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('Cloud progress restored to this device. A recovery copy was saved first.');
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
        const written = await writeProgressSnapshot(client, cloud.revision, local, controller.signal);
        if (controller.signal.aborted) return;
        const afterWrite = await client.auth.getSession();
        if (afterWrite.data.session?.user.id !== userId) return;
        if ('conflict' in written) {
          setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
          setMessage('Cloud progress changed on another device. Choose which copy to keep.');
        } else {
          saveSyncBase(userId, written.revision, local);
          localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
          localStorage.setItem(LAST_USER_KEY, userId);
          if (written.updatedAt) setLastSynced(written.updatedAt);
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
        const latestCloud = await fetchProgressSnapshot(client, userId, controller.signal);
        if (controller.signal.aborted) return;
        const currentSession = await client.auth.getSession();
        if (currentSession.data.session?.user.id !== userId) return;
        const latestLocal = makeBackup().records;
        if (latestCloud?.revision !== cloud.revision || !sameProgressRecords(latestLocal, base.records)) {
          setPending({ kind: 'conflict', local: latestLocal, cloud: latestCloud });
          setMessage('Progress changed while sync was running. Review both copies before continuing.');
        } else {
          installCloudProgress(latestCloud.records);
          saveSyncBase(userId, latestCloud.revision, latestCloud.records);
          localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('New cloud progress was downloaded. Your previous device copy is available in Recovery copy.');
        }
      } else if (localChanged && cloudChanged) {
        const reconciliation = reconcileProgressRecords(local, cloud.records);
        if (!reconciliation.safe) {
          setPending({ kind: 'conflict', local, cloud });
          setMessage('Both copies changed in ways that cannot be safely combined. Review each copy before continuing.');
          return;
        }
        let latest = await fetchProgressSnapshot(client, userId, controller.signal);
        for (let attempt = 0; attempt < 2; attempt++) {
          if (controller.signal.aborted) return;
          const activeSession = await client.auth.getSession();
          if (activeSession.data.session?.user.id !== userId || localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) !== userId) return;
          const currentLocal = makeBackup().records;
          if (!sameProgressRecords(currentLocal, local) || !latest) {
            setPending({ kind: 'conflict', local: currentLocal, cloud: latest });
            setMessage('Progress changed while sync was running. Review both copies before continuing.');
            return;
          }
          const result = reconcileProgressRecords(currentLocal, latest.records);
          if (!result.safe) {
            setPending({ kind: 'conflict', local: currentLocal, cloud: latest });
            setMessage('Both copies changed in ways that cannot be safely combined. Review each copy before continuing.');
            return;
          }
          if (sameProgressRecords(result.records, latest.records)) {
            if (sameProgressRecords(makeBackup().records, local)) installCloudProgress(result.records);
            saveSyncBase(userId, latest.revision, latest.records);
            localStorage.setItem(LAST_USER_KEY, userId);
            setMessage('Progress is already synced.');
            return;
          }
          const written = await writeProgressSnapshot(client, latest.revision, result.records, controller.signal);
          if (controller.signal.aborted) return;
          if ('conflict' in written) {
            if (attempt === 0 && written.snapshot) { latest = written.snapshot; continue; }
            setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
            setMessage('Cloud progress changed again. Review the latest copies before continuing.');
            return;
          }
          if (sameProgressRecords(makeBackup().records, local)) installCloudProgress(result.records);
          saveSyncBase(userId, written.revision, result.records);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('Progress from both devices was safely combined and synced.');
          if (!sameProgressRecords(makeBackup().records, result.records)) window.dispatchEvent(new Event('coptic-progress-change'));
          return;
        }
      } else {
        setPending({ kind: 'conflict', local, cloud });
        setMessage('Both this device and the cloud changed since the last sync. Choose which copy to keep.');
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(progressSyncErrorMessage(failure));
    } finally {
      releaseSyncLock();
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    setReady(false); setPending(null); setMessage(''); setError('');
    if (!userId) { setReady(true); return; }
    setReady(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (navigator.onLine) void synchronize(); }, 500); };
    if (navigator.onLine) schedule();
    window.addEventListener('coptic-progress-change', schedule);
    window.addEventListener('online', schedule);
    return () => { clearTimeout(timer); window.removeEventListener('coptic-progress-change', schedule); window.removeEventListener('online', schedule); };
  }, [userId, synchronize]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => () => { requestRef.current?.abort(); }, [userId]);

  async function choose(kind: 'upload' | 'download') {
    if (!userId || !pending || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true); setError(''); setPending(null);
    const releaseSyncLock = await acquireProgressSyncLock();
    try {
      if (controller.signal.aborted) return;
      const client = await getSupabaseClient();
      const cloud = await fetchProgressSnapshot(client, userId, controller.signal);
      if (controller.signal.aborted) return;
      const currentSession = await client.auth.getSession();
      if (currentSession.data.session?.user.id !== userId) return;
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
        if (cloud && sameProgressRecords(local, cloud.records)) {
          saveSyncBase(userId, cloud.revision, cloud.records);
          localStorage.setItem(LAST_USER_KEY, userId);
          setMessage('Your progress is already synced.');
          return;
        }
        const written = await writeProgressSnapshot(client, cloud?.revision ?? 0, local, controller.signal);
        if (controller.signal.aborted) return;
        const afterWrite = await client.auth.getSession();
        if (afterWrite.data.session?.user.id !== userId) return;
        if ('conflict' in written) {
          setPending({ kind: 'conflict', local: makeBackup().records, cloud: written.snapshot });
          setMessage('Cloud progress changed on another device. Review both copies before continuing.');
        } else {
          saveSyncBase(userId, written.revision, local);
          localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
          localStorage.setItem(LAST_USER_KEY, userId);
          if (written.updatedAt) setLastSynced(written.updatedAt);
          if (sameProgressRecords(makeBackup().records, local)) setMessage('This device’s progress is synced to your account.');
          else {
            setMessage('More progress changed during upload. The uploaded copy is safe; the newer local progress is still pending sync.');
            window.dispatchEvent(new Event('coptic-progress-change'));
          }
        }
      } else if (cloud) {
        const beforeInstall = await client.auth.getSession();
        if (beforeInstall.data.session?.user.id !== userId) return;
        const currentLocal = makeBackup().records;
        if (!sameProgressRecords(currentLocal, pending.local)) {
          setPending({ kind: 'conflict', local: currentLocal, cloud });
          setMessage('This device changed while you were reviewing. Review the latest copies before continuing.');
          return;
        }
        installCloudProgress(cloud.records);
        saveSyncBase(userId, cloud.revision, cloud.records);
        localStorage.setItem(PROGRESS_SYNC_OPT_IN_KEY, userId);
        localStorage.setItem(LAST_USER_KEY, userId);
        setMessage('Cloud progress downloaded. Your previous device copy is available in Recovery copy.');
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(progressSyncErrorMessage(failure));
    } finally {
      releaseSyncLock();
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
    }
  }

  if (!supabaseAuthConfigured) return <section className="settings-cloud-progress" aria-labelledby="progress-sync-title"><h2 id="progress-sync-title" className="settings-section-title">Cloud sync</h2><div className="settings-group settings-group--content"><p>Unavailable</p></div></section>;
  return <section className="settings-cloud-progress" aria-labelledby="progress-sync-title">
    <h2 id="progress-sync-title" className="settings-section-title">Cloud sync</h2>
    <div className="settings-group settings-group--content">
      {!userId ? <p>Progress stays on this device while signed out.</p> : <>
        <p className="settings-sync-state" role="status">{busy ? 'Syncing' : !online ? 'Offline' : error ? 'Error' : pending || /review|choice|conflict|paused/iu.test(message) ? 'Needs attention' : /pending|waiting to upload|ready to sync/iu.test(message) || !message ? 'Pending' : 'Synced'}{lastSynced && <small>Last synced: {new Date(lastSynced).toLocaleString()}</small>}</p>
        <div className="settings-action-row settings-cloud-progress__sync-action"><button type="button" className="ui-secondary" disabled={!ready || busy || !online} onClick={() => void synchronize()}>{busy ? 'Syncing…' : 'Sync now'}</button></div>
        {error && <p className="settings-cloud-progress__error" role="alert">{error}</p>}
        {pending && <div className="ui-panel settings-cloud-progress__pending" role="region" aria-label="Review cloud progress">
          <h3>{pending.kind === 'upload' ? 'Upload this device’s progress?' : pending.kind === 'download' ? 'Download cloud progress?' : 'Choose a progress copy'}</h3>
          {pending.kind === 'conflict' && <p>{comparison?.summary} Unique learning records are preserved when a safe automatic merge is possible. This conflict needs your choice; cancelling keeps both copies where they are.</p>}
          <p>{pending.kind === 'upload'
            ? 'This sends the validated learning records on this device to your signed-in account.'
            : pending.kind === 'download'
              ? 'This replaces progress on this device with the cloud copy. A recovery copy of this device’s progress will be saved first.'
              : 'Both copies changed since the last sync. Keeping one replaces the other copy. A recovery copy is saved before a cloud download.'}</p>
          <div className="settings-action-row settings-cloud-progress__actions">
            {pending.kind !== 'upload' && <button type="button" className={comparison?.recommended === 'cloud' ? 'ui-primary' : 'ui-secondary'} disabled={busy} onClick={() => void choose('download')}>Use cloud progress on this device{comparison?.recommended === 'cloud' ? ' (Recommended)' : ''}</button>}
            {pending.kind !== 'download' && <button type="button" className={pending.kind !== 'conflict' || comparison?.recommended === 'device' ? 'ui-primary' : 'ui-secondary'} disabled={busy} onClick={() => void choose('upload')}>{pending.kind === 'conflict' ? `Replace cloud with this device${comparison?.recommended === 'device' ? ' (Recommended)' : ''}` : 'Upload this device’s progress'}</button>}
            <button type="button" className="ui-secondary" disabled={busy} onClick={() => { setPending(null); setMessage('No progress was changed. Sync is paused until you choose or review again.'); }}>Cancel</button>
          </div>
        </div>}
      </>}
    </div>
  </section>;
}
