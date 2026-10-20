'use client';

import { useEffect, useState } from 'react';
import { CLOUD_SYNC_RECOVERY_KEY, RECOVERY_KEY, undoCloudSync, undoRestore } from '@/lib/progressStorage';

export default function ProgressBackup() {
  const [hasLocal, setHasLocal] = useState(false); const [hasCloud, setHasCloud] = useState(false);
  const [recover, setRecover] = useState<'local' | 'cloud' | null>(null); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { try { setHasLocal(Boolean(localStorage.getItem(RECOVERY_KEY))); setHasCloud(Boolean(localStorage.getItem(CLOUD_SYNC_RECOVERY_KEY))); } catch { setError('Recovery storage is unavailable on this device.'); } }, []);
  function restore(kind: 'local' | 'cloud') {
    try {
      if (kind === 'cloud') undoCloudSync(); else undoRestore();
      setRecover(null); setMessage('Recovery copy restored. Reload the app to refresh your progress.');
      window.dispatchEvent(new Event('coptic-learning-change')); window.dispatchEvent(new Event('coptic-vocabulary-change'));
      setHasLocal(kind !== 'local' && hasLocal); setHasCloud(kind !== 'cloud' && hasCloud);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Recovery could not be completed.'); }
  }
  return <section aria-labelledby="recovery-title"><h2 id="recovery-title" className="settings-section-title">Recovery</h2><div className="settings-group settings-group--content">
    <p>Progress changes are protected by validated snapshots and recovery journals. Before cloud progress is installed, the current device copy is saved automatically.</p>
    {hasCloud && <button className="ui-secondary" type="button" onClick={() => setRecover('cloud')}>Recover progress from before the last cloud restore</button>}
    {hasLocal && <button className="ui-secondary" type="button" onClick={() => setRecover('local')}>Recover previous progress</button>}
    {!hasCloud && !hasLocal && !error && <p className="settings-note">No recovery copy is currently available. Cloud restores and progress recovery actions create these copies automatically.</p>}
    {recover && <div className="ui-panel" role="group" aria-label="Confirm progress recovery"><p>Replace current progress with this recovery copy? The current progress will first be protected by the transactional recovery system.</p><button className="ui-primary" type="button" onClick={() => restore(recover)}>Restore recovery copy</button>{' '}<button className="ui-secondary" type="button" onClick={() => setRecover(null)}>Cancel</button></div>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div></section>;
}
