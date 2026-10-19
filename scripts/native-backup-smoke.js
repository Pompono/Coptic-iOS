// CI-only fixture: copied into the disposable Debug simulator app by build.yml.
(() => {
  if (location.pathname !== '/settings/') { location.href = '/settings/'; return { status: 'waiting' }; }
  const buttons = () => [...document.querySelectorAll('button')];
  const button = text => buttons().find(item => item.textContent.trim() === text && !item.disabled);
  const input = () => document.querySelector('input[type=file]');
  if (!button('Export Progress') || !input()) return { status: 'waiting' };
  const settingsText = document.body.textContent || '';
  if (!settingsText.includes('Progress syncing is coming later')) return { status: 'waiting' };
  // Static HTML can appear before React has attached the real input handler.
  if (!Object.keys(input()).some(key => key.startsWith('__reactProps'))) return { status: 'waiting' };
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
    sessionStorage.setItem('native-backup-phase', 'seeded');
    location.reload();
    return { status: 'waiting' };
  }
  if (phase === 'restoring' && !window.__backupAwaitingReload) {
    if (!matches(restored)) return { status: 'failed', message: 'Restored records changed across relaunch' };
    if (!document.body.textContent.includes('Progress restored successfully.')) return { status: 'waiting' };
    return { status: 'passed' };
  }
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
      const select = backup => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([JSON.stringify(backup)], 'coptic-progress-smoke.json', { type: 'application/json' }));
        input().files = transfer.files;
        input().dispatchEvent(new Event('change', { bubbles: true }));
      };
      try {
        const secureKey = `ci-auth-storage-${Date.now()}`;
        await window.Capacitor.nativePromise('SecureAuthStorage', 'setItem', { key: secureKey, value: 'keychain-roundtrip' });
        const stored = await window.Capacitor.nativePromise('SecureAuthStorage', 'getItem', { key: secureKey });
        if (stored.value !== 'keychain-roundtrip') throw new Error('Native secure auth storage round-trip failed');
        await window.Capacitor.nativePromise('SecureAuthStorage', 'removeItem', { key: secureKey });
        if (!matches(records)) throw new Error('Legacy records were rewritten during startup');
        button('Export Progress').click();
        // Swift observes the actual UIActivityViewController and cancels it.
        await wait(() => document.body.textContent.includes('Export cancelled.'));
        if (!matches(records)) throw new Error('Cancelled native sharing changed progress');
        const cache = await window.Capacitor.nativePromise('Filesystem', 'readdir', { path: 'progress-backups', directory: 'CACHE' });
        if (cache.files.some(file => file.name.endsWith('.json'))) throw new Error('Cancelled export left a temporary backup');
        const backup = { format: 'coptic-progress-backup', version: 1, exportedAt: new Date().toISOString(), records: restored };
        select(backup);
        await wait(() => button('Replace progress and restore'));
        if (!document.body.textContent.includes('Currently on this device:') || !document.body.textContent.includes('40 XP')) throw new Error('Current progress summary missing');
        button('Cancel').click();
        if (!matches(records)) throw new Error('Import cancellation changed progress');
        select({ ...backup, version: 99 });
        await wait(() => document.body.textContent.includes('unsupported progress backup version'));
        if (!matches(records)) throw new Error('Invalid backup changed progress');
        select(backup);
        await wait(() => button('Replace progress and restore'));
        sessionStorage.setItem('native-backup-phase', 'restoring');
        window.__backupAwaitingReload = true;
        button('Replace progress and restore').click();
      } catch (error) { window.__nativeBackupSmoke = { status: 'failed', message: error.message }; }
    })();
  }
  return window.__nativeBackupSmoke;
})()
