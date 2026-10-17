import { Capacitor } from '@capacitor/core';

export async function saveProgressFile(json: string, name = 'coptic-progress.json') {
  const datedName = `${name.replace(/\.json$/i, '')}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const directory = Directory.Cache;
    const folder = 'progress-backups';
    await Filesystem.mkdir({ path: folder, directory, recursive: true });
    // Keep successful exports for asynchronous recipients, but bound retention.
    // Pruning is best effort and only touches this feature's own JSON files.
    try {
      const { files } = await Filesystem.readdir({ path: folder, directory });
      for (const file of files) {
        if (file.type === 'file' && /^coptic-progress-.*\.json$/.test(file.name) && file.mtime < Date.now() - 86400000) {
          await Filesystem.deleteFile({ path: `${folder}/${file.name}`, directory }).catch(() => {});
        }
      }
    } catch { /* Cleanup failure must not prevent a new backup. */ }
    const path = `${folder}/${datedName}`;
    const file = await Filesystem.writeFile({ path, data: json, directory, encoding: Encoding.UTF8 });
    try {
      if (!file.uri.startsWith('file://')) throw new Error('The backup file URL is unavailable.');
      // The .json file extension supplies the native JSON content type.
      await Share.share({ title: 'Progress backup', files: [file.uri], dialogTitle: 'Save or share progress' });
      return 'Share completed. Keep the backup you saved in Files or another safe location.';
    } catch (error) {
      await Filesystem.deleteFile({ path, directory }).catch(() => {});
      const message = String((error as { message?: string })?.message ?? error);
      if (/^share cancel(?:led|ed)$/i.test(message)) return 'Export cancelled. No external save was confirmed.';
      throw new Error(`Could not share the backup. Your learning progress has not changed. ${message}`);
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = datedName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'Backup download started. Keep the file in a safe location.';
}
