'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigateSettings, rememberSettingsPush, requestSettingsNavigation } from '@/lib/settingsNavigation';
import { CLOUD_SYNC_RECOVERY_KEY, RECOVERY_KEY, recoveryFile, undoCloudSync, undoRestore } from '@/lib/progressStorage';

export default function ProgressBackup({ focused = false }: { focused?: boolean }) {
  const router = useRouter();
  const [hasLocal, setHasLocal] = useState(false); const [hasCloud, setHasCloud] = useState(false);
  const [recover, setRecover] = useState<'local' | 'cloud' | null>(null); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    const valid = (key: typeof RECOVERY_KEY | typeof CLOUD_SYNC_RECOVERY_KEY) => {
      try { recoveryFile(localStorage, key); return true; }
      catch (failure) { if (!(failure instanceof Error) || failure.message !== 'No recovery copy is available.') setError('A recovery copy could not be validated.'); return false; }
    };
    try { setHasLocal(valid(RECOVERY_KEY)); setHasCloud(valid(CLOUD_SYNC_RECOVERY_KEY)); }
    catch { setError('Recovery storage is unavailable on this device.'); }
  }, []);
  function restore(kind: 'local' | 'cloud') {
    try {
      if (kind === 'cloud') undoCloudSync(); else undoRestore();
      setRecover(null); setMessage('Recovery copy restored. Reload the app to refresh your progress.');
      window.dispatchEvent(new Event('coptic-learning-change')); window.dispatchEvent(new Event('coptic-vocabulary-change'));
      setHasLocal(Boolean(localStorage.getItem(RECOVERY_KEY))); setHasCloud(Boolean(localStorage.getItem(CLOUD_SYNC_RECOVERY_KEY)));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Recovery could not be completed.'); }
  }
  return <section aria-labelledby="recovery-title">{!focused && <><h2 id="recovery-title" className="settings-section-title">Recovery</h2><div className="settings-group"><button className="settings-row settings-row--link" type="button" onClick={() => { if (requestSettingsNavigation('/settings/recovery')) return; rememberSettingsPush('/settings/recovery'); navigateSettings(() => router.push('/settings/recovery')); }}><span>Recover progress</span><span className="settings-chevron" aria-hidden="true">›</span></button></div></>}
    {focused && <div className="settings-group settings-group--content">
    {!hasCloud && !hasLocal && !error && <p>No recovery copies are available.</p>}
    {hasCloud && <div className="recovery-option"><strong>Before last cloud restore</strong><button className="ui-secondary" type="button" onClick={() => setRecover('cloud')}>Recover</button></div>}
    {hasLocal && <div className="recovery-option"><strong>Previous progress</strong><button className="ui-secondary" type="button" onClick={() => setRecover('local')}>Recover</button></div>}
    {recover && <div className="ui-panel" role="group" aria-label="Confirm progress recovery"><p>Replace current progress with the selected recovery copy?</p><button className="ui-primary" type="button" onClick={() => restore(recover)}>Restore recovery copy</button>{' '}<button className="ui-secondary" type="button" onClick={() => setRecover(null)}>Cancel</button></div>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>}
  </section>;
}

