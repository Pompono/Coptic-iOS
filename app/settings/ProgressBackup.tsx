"use client";
import { useEffect, useRef, useState } from 'react';
import { backupSummary, CLOUD_SYNC_RECOVERY_KEY, makeBackup, parseBackupBytes, inspectCurrentProgress, recoveryFile, restoreBackup, undoCloudSync, undoRestore, type Backup } from '@/lib/progressStorage';
import { saveProgressFile } from '@/lib/progressFiles';

export default function ProgressBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [current, setCurrent] = useState<{ summary: string; snapshot: string } | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [recover, setRecover] = useState(false);
  const [recoverCloud, setRecoverCloud] = useState(false);
  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('coptic-progress-restore-notice');
      if (notice) { setMessage(notice); sessionStorage.removeItem('coptic-progress-restore-notice'); }
    } catch { /* A successful restore still reloads if session storage is denied. */ }
    return () => { if (reloadTimer.current) clearTimeout(reloadTimer.current); };
  }, []);
  function finishRestore(notice: string) {
    setPending(null); setRestored(true); setMessage(`${notice} Reloading…`);
    window.dispatchEvent(new Event('coptic-learning-change'));
    window.dispatchEvent(new Event('coptic-vocabulary-change'));
    try { sessionStorage.setItem('coptic-progress-restore-notice', notice); } catch { /* Optional success message only. */ }
    // Reinitialize all screens and clear stale cached lesson/reader state.
    reloadTimer.current = setTimeout(() => window.location.reload(), 800);
  }
  async function action(task: () => void | Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Progress backup could not be completed.'); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="progress-backup-title">
    <h2 id="progress-backup-title" className="settings-section-title">Progress &amp; Backup</h2>
    <p className="settings-note">Your learning progress stays on this device. Export a backup to keep lesson completion, XP, streaks, vocabulary reviews, and your saved passage safe.</p>
    <div className="settings-group">
      <div className="settings-row"><button type="button" disabled={busy || restored} onClick={() => void action(async () => setMessage(await saveProgressFile(JSON.stringify(makeBackup(), null, 2))))}>Export Progress</button></div>
      <div className="settings-row"><button type="button" disabled={busy || restored} onClick={() => input.current?.click()}>Import Progress</button>
        <input ref={input} aria-label="Select progress backup" type="file" accept=".json,application/json" hidden onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; setPending(null);
          if (file) void action(async () => {
            if (file.size > 20 * 1024 * 1024) throw new Error('Please select a backup smaller than 20 MB.');
            const backup = parseBackupBytes(await file.arrayBuffer());
            const state = inspectCurrentProgress();
            setCurrent(state); setPending(backup);
          });
        }} /></div>
    </div>
    <p className="settings-note">Deleting or reinstalling the app may remove locally stored progress. Save your backup outside the app.</p>
    {pending && <div className="ui-panel" role="region" aria-label="Confirm progress restoration" style={{ padding: 16 }}>
      <h3>Restore this backup?</h3>
      <p>Exported {new Date(pending.exportedAt).toLocaleString()}</p>
      <p><strong>Backup:</strong> {backupSummary(pending)}</p>
      <p><strong>Currently on this device:</strong> {current?.summary}</p>
      <p>This will replace all learning progress currently on this device, including records absent from the backup. Nothing will be merged. A recoverable copy of your current progress will be saved first.</p>
      <button type="button" className="ui-primary" disabled={busy || restored} onClick={() => void action(() => {
        restoreBackup(pending, true, localStorage, current?.snapshot);
        finishRestore('Progress restored successfully.');
      })}>Replace progress and restore</button>{' '}
      <button type="button" className="ui-secondary" disabled={busy || restored} onClick={() => { setPending(null); setMessage('Import cancelled. Your progress has not changed.'); }}>Cancel</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {restored && <button className="ui-primary" onClick={() => window.location.reload()}>Reload app</button>}
    <details><summary>Recovery copy</summary>
      <p className="settings-note">The progress saved before the most recent restore or reset is kept on this device. Export it before another restore. Raw recovery files preserve damaged records for repair and cannot be imported as normal backups.</p>
      <button disabled={busy || restored} onClick={() => void action(async () => setMessage(await saveProgressFile(recoveryFile(), 'coptic-progress-recovery.json')))}>Export recovery copy</button>{' '}
      <button disabled={busy || restored} onClick={() => void action(async () => setMessage(await saveProgressFile(recoveryFile(localStorage, CLOUD_SYNC_RECOVERY_KEY), 'coptic-cloud-sync-recovery.json')))}>Export pre-sync recovery copy</button>{' '}
      <button disabled={busy || restored} onClick={() => setRecoverCloud(true)}>Recover pre-sync progress</button>{' '}
      <button disabled={busy || restored} onClick={() => setRecover(true)}>Recover previous progress</button>
      {recoverCloud && <div><p>Replace current progress with the copy saved immediately before the last cloud download? A new local recovery copy will be saved first.</p><button disabled={busy || restored} onClick={() => void action(() => { undoCloudSync(); setRecoverCloud(false); finishRestore('Pre-sync progress recovered.'); })}>Confirm pre-sync recovery</button>{' '}<button disabled={busy || restored} onClick={() => setRecoverCloud(false)}>Cancel</button></div>}
      {recover && <div><p>Replace current progress with the saved recovery copy? This may restore damaged records if they were already damaged before import.</p><button disabled={busy || restored} onClick={() => void action(() => { undoRestore(); setRecover(false); finishRestore('Previous progress recovered.'); })}>Confirm recovery</button>{' '}<button disabled={busy || restored} onClick={() => setRecover(false)}>Cancel recovery</button></div>}
    </details>
  </section>;
}
