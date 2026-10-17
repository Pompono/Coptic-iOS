import { Capacitor } from '@capacitor/core';

export async function saveProgressFile(json: string, name = `coptic-progress-${new Date().toISOString().replace(/[:.]/g, '-')}.json`) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const file = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    // Share's promise settles when the sheet closes. Keep the cache file available to recipients.
    await Share.share({ title: 'Progress backup', url: file.uri, dialogTitle: 'Save or share progress' });
    return 'Share sheet closed. Keep your backup in Files or another safe location.';
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'Backup download started. Keep the file in a safe location.';
}
