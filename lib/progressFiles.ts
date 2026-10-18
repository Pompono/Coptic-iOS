import { Capacitor } from '@capacitor/core';

async function ensureBackupDirectory(Filesystem: typeof import('@capacitor/filesystem').Filesystem, directory: import('@capacitor/filesystem').Directory, path: string) {
  const conflict = (type: string) => new Error(`Cannot export progress because '${path}' is a ${type}, not a folder. Remove or rename that item in app storage, then try again.`);
  const statDirectory = async () => {
    const info = await Filesystem.stat({ path, directory });
    if (info.type === 'directory') return true;
    if (info.type === 'file') throw conflict('file');
    throw conflict('unsupported item');
  };

  try {
    if (await statDirectory()) return;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Cannot export progress because')) throw error;
    // A missing directory and an existence race both reach mkdir. Other errors
    // are only accepted if mkdir or a subsequent stat proves the directory exists.
  }

  try {
    await Filesystem.mkdir({ path, directory, recursive: true });
    return;
  } catch (mkdirError) {
    // Another export may have created it between stat and mkdir. Verify its type
    // before treating that native mkdir error as a harmless race.
    try {
      if (await statDirectory()) return;
    } catch (statError) {
      if (statError instanceof Error && statError.message.startsWith('Cannot export progress because')) throw statError;
      const mkdirMessage = String((mkdirError as { message?: string })?.message ?? mkdirError);
      const statMessage = String((statError as { message?: string })?.message ?? statError);
      throw new Error(`Could not prepare the progress backup folder. Check that the app has storage access and enough free space, then try Export Progress again. ${mkdirMessage} ${statMessage}`);
    }
  }
}

export async function saveProgressFile(json: string, name = 'coptic-progress.json') {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  const datedName = `${name.replace(/\.json$/i, '')}-${new Date().toISOString().replace(/[:.]/g, '-')}-${random}.json`;
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const directory = Directory.Cache;
    const folder = 'progress-backups';
    await ensureBackupDirectory(Filesystem, directory, folder);
    // Keep files for a day in case an external recipient is still reading one.
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
    let file: { uri: string };
    try {
      file = await Filesystem.writeFile({ path, data: json, directory, encoding: Encoding.UTF8 });
      if (!file.uri.startsWith('file://')) throw new Error('The backup file URL is unavailable.');
      // The .json file extension supplies the native JSON content type.
      await Share.share({ title: 'Progress backup', files: [file.uri], dialogTitle: 'Save or share progress' });
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? error);
      if (/^share cancel(?:led|ed)$/i.test(message)) return 'Export cancelled. No file was saved. Tap Export Progress to try again.';
      throw new Error(`Could not open the iOS save or share sheet. Check available storage and try Export Progress again. Your learning progress is unchanged. ${message}`);
    } finally {
      // Share.share settles from the native activity completion callback. Only
      // then is it safe to remove this temporary source file.
      await Filesystem.deleteFile({ path, directory }).catch(() => {});
    }
    return 'Export shared. If you chose Save to Files, confirm the destination and filename in Files.';
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = datedName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'Backup download started. Keep the file in a safe location.';
}
