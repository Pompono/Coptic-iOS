// CI-only fixture: copied into the disposable Debug simulator app by build.yml.
(() => {
  if (location.pathname !== '/settings/recovery/') { const previous = location.href; location.href = '/settings/recovery/'; return { status: 'waiting', reason: `Navigating from ${previous}` }; }
  if (!window.__nativeBackupApi) {
    if (!document.getElementById('native-backup-api')) {
      const script = document.createElement('script');
      script.id = 'native-backup-api'; script.src = '/native-backup-api.js';
      script.onerror = () => { window.__nativeBackupSmoke = { status: 'failed', message: 'CI backup API bundle failed to load' }; };
      document.head.appendChild(script);
    }
    return window.__nativeBackupSmoke || { status: 'waiting', reason: `Loading backup API at ${location.href}` };
  }
  const api = window.__nativeBackupApi;
  const buttons = () => [...document.querySelectorAll('button')];
  const button = text => buttons().find(item => item.textContent.trim() === text && !item.disabled);
  const text = 'ⲡⲓⲱ\u0305ⲓⲕ\u0301';
  const records = {
    'coptic-progress': JSON.stringify({ xp: 40, streak: 2, lastCompletedDate: '2026-01-01', completedLessons: ['legacy-lesson'] }),
    'coptic-unit-progress:legacy': '["legacy-step"]',
    'coptic-unit-failed-steps:legacy': '["retry-step"]',
    'coptic-reader:v1': JSON.stringify({ version: 1, passageId: 'custom', draft: text }),
    'coptic-vocabulary:v1': JSON.stringify({ version: 1, cards: [{ id: 'legacy-word', word: text, meaning: 'bread', createdAt: 1000, dueAt: 86401000, intervalDays: 1, reviews: 2, lapses: 1, streak: 1, lastReviewedAt: 1000 }] }),
    'coptic-learning:v1': JSON.stringify({ version: 1, skills: { legacy: { word: text, meaning: 'bread', attempts: 3, correct: 2, lapses: 1, dueAt: 86401000, lastSeen: 1000, successfulDays: 1 } } })
  };
  const restored = { ...records, 'coptic-progress': JSON.stringify({ xp: 80, streak: 4, lastCompletedDate: '2026-01-02', completedLessons: ['restored-lesson'] }) };
  const matches = source => Object.entries(source).every(([key, value]) => localStorage.getItem(key) === value);
  const phase = sessionStorage.getItem('native-backup-phase');
  if (!phase) {
    for (const [key, value] of Object.entries(records)) localStorage.setItem(key, value);
    localStorage.setItem(api.RECOVERY_KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), records: restored }));
    sessionStorage.setItem('native-backup-phase', 'seeded');
    location.reload();
    return { status: 'waiting', reason: 'Reloading seeded recovery records' };
  }
  if (phase === 'restoring' && !window.__backupAwaitingReload) {
    if (!matches(restored)) return { status: 'failed', message: 'Restored records changed across relaunch' };
    return { status: 'passed' };
  }
  // Wait for the current recovery page's effect and real React handler.
  if (!button('Recover') || !Object.keys(button('Recover')).some(key => key.startsWith('__reactProps'))) return { status: 'waiting', reason: `Recovery UI at ${location.href}; phase=${phase}; buttons=${buttons().map(item => item.textContent.trim()).join('|')}; text=${document.body.textContent.slice(0, 400)}` };
  if (!window.__nativeBackupSmoke) {
    window.__nativeBackupSmoke = { status: 'running' };
    (async () => {
      const wait = async predicate => {
        for (let attempt = 0; attempt < 150; attempt++) {
          if (predicate()) return;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Backup UI timed out');
      };
      try {
        const secureKey = `ci-auth-storage-${Date.now()}`;
        await window.Capacitor.nativePromise('SecureAuthStorage', 'setItem', { key: secureKey, value: 'keychain-roundtrip' });
        const stored = await window.Capacitor.nativePromise('SecureAuthStorage', 'getItem', { key: secureKey });
        if (stored.value !== 'keychain-roundtrip') throw new Error('Native secure auth storage round-trip failed');
        await window.Capacitor.nativePromise('SecureAuthStorage', 'removeItem', { key: secureKey });
        if (!matches(records)) throw new Error('Legacy records were rewritten during startup');
        // Swift observes the actual UIActivityViewController and cancels it.
        const result = await api.saveProgressFile(JSON.stringify(api.makeBackup()));
        if (!result.includes('Export cancelled.')) throw new Error('Native share cancellation was not reported');
        if (!matches(records)) throw new Error('Cancelled native sharing changed progress');
        const cache = await window.Capacitor.nativePromise('Filesystem', 'readdir', { path: 'progress-backups', directory: 'CACHE' });
        if (cache.files.some(file => file.name.endsWith('.json'))) throw new Error('Cancelled export left a temporary backup');
        const backup = { format: 'coptic-progress-backup', version: 1, exportedAt: new Date().toISOString(), records: restored };
        if (!api.inspectCurrentProgress().summary.includes('40 XP')) throw new Error('Current progress summary missing');
        if (api.restoreBackup(backup, false) !== false || !matches(records)) throw new Error('Unconfirmed import changed progress');
        let rejected = false;
        try { api.parseBackup(JSON.stringify({ ...backup, version: 99 })); }
        catch (error) { rejected = /unsupported progress backup version/.test(error.message); }
        if (!rejected || !matches(records)) throw new Error('Invalid backup was accepted or changed progress');
        button('Recover').click();
        await wait(() => button('Restore recovery copy'));
        button('Cancel').click();
        await wait(() => !button('Restore recovery copy'));
        if (!matches(records)) throw new Error('Import cancellation changed progress');
        button('Recover').click();
        await wait(() => button('Restore recovery copy'));
        button('Restore recovery copy').click();
        await wait(() => document.body.textContent.includes('Recovery copy restored.'));
        if (!matches(restored)) throw new Error('Recovery did not restore the selected records');
        sessionStorage.setItem('native-backup-phase', 'restoring');
        window.__backupAwaitingReload = true;
        location.reload();
      } catch (error) { window.__nativeBackupSmoke = { status: 'failed', message: error.message }; }
    })();
  }
  return window.__nativeBackupSmoke;
})()
