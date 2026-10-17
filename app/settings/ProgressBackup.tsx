"use client";
import { useRef, useState } from 'react';
import { backupSummary, makeBackup, parseBackup, recoveryFile, restoreBackup, undoRestore, type Backup } from '@/lib/progressStorage';
import { saveProgressFile } from '@/lib/progressFiles';

export default function ProgressBackup() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [recover, setRecover] = useState(false);
  async function action(task: () => void | Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Progress backup could not be completed.'); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="progress-backup-title">
    <h2 id="progress-backup-title" className="settings-section-title">Progress &amp; Backup</h2>
    <p className="settings-note">Your learning progress stays on this device. Export a backup to keep lesson completion, XP, streaks, vocabulary reviews, and your saved passage safe.</p>
    <div className="settings-group">
      <div className="settings-row"><button type="button" disabled={busy} onClick={() => void action(async () => setMessage(await saveProgressFile(JSON.stringify(makeBackup(), null, 2))))}>Export Progress</button></div>
      <div className="settings-row"><button type="button" disabled={busy} onClick={() => input.current?.click()}>Import Progress</button>
        <input ref={input} aria-label="Select progress backup" type="file" accept=".json,application/json" hidden onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; setPending(null);
          if (file) void action(async () => {
            if (file.size > 20 * 1024 * 1024) throw new Error('Please select a backup smaller than 20 MB.');
            setPending(parseBackup(await file.text()));
          });
        }} /></div>
    </div>
    <p className="settings-note">Deleting or reinstalling the app may remove locally stored progress. Save your backup outside the app.</p>
    {pending && <div className="ui-panel" role="region" aria-label="Confirm progress restoration" style={{ padding: 16 }}>
      <h3>Restore this backup?</h3>
      <p>Exported {new Date(pending.exportedAt).toLocaleString()}</p>
      <p>{backupSummary(pending)}</p>
      <p>This will replace all learning progress currently on this device, including records absent from the backup. Nothing will be merged. A recoverable copy of your current progress will be saved first.</p>
      <button type="button" className="ui-primary" disabled={busy} onClick={() => void action(() => {
        restoreBackup(pending, true); setPending(null); setRestored(true);
        window.dispatchEvent(new Event('coptic-learning-change'));
        window.dispatchEvent(new Event('coptic-vocabulary-change'));
        setMessage('Progress restored successfully. Reload to continue with your restored progress.');
      })}>Replace progress and restore</button>{' '}
      <button type="button" className="ui-secondary" disabled={busy} onClick={() => { setPending(null); setMessage('Import cancelled. Your progress has not changed.'); }}>Cancel</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {restored && <button className="ui-primary" onClick={() => window.location.reload()}>Reload app</button>}
    <details><summary>Recovery copy</summary>
      <p className="settings-note">The progress saved before the most recent restore or reset is kept on this device. Export it before another restore. Raw recovery files preserve damaged records for repair and cannot be imported as normal backups.</p>
      <button disabled={busy} onClick={() => void action(async () => setMessage(await saveProgressFile(recoveryFile(), 'coptic-progress-recovery.json')))}>Export recovery copy</button>{' '}
      <button disabled={busy} onClick={() => setRecover(true)}>Recover previous progress</button>
      {recover && <div><p>Replace current progress with the saved recovery copy? This may restore damaged records if they were already damaged before import.</p><button disabled={busy} onClick={() => void action(() => { undoRestore(); setRecover(false); setRestored(true); setMessage('Previous progress recovered. Reload to continue.'); })}>Confirm recovery</button>{' '}<button disabled={busy} onClick={() => setRecover(false)}>Cancel recovery</button></div>}
    </details>
  </section>;
}
