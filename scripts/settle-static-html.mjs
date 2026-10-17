import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
const outputRoot = path.resolve('out');
const appRoutes = new Set(['_not-found', '404', 'dictionary', 'learn', 'read', 'settings', 'translator', 'vocabulary']);

// Capacitor serves a complete static document, not a streamed Next response.
// Let the browser finish parsing it before Next hydrates. Async boot scripts
// can run while head/body parsing is in progress and misplace hoisted metadata.
async function settle(directory) {
  let entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('__next.')) {
      await flattenWindowsSegmentDirectory(directory, path.join(directory, entry.name));
    }
  }
  entries = await readdir(directory, { withFileTypes: true });
  const directories = [];
  for (const entry of entries) {
    if (directory === outputRoot && entry.isDirectory() && !appRoutes.has(entry.name)) continue;
    if (entry.isDirectory()) directories.push(path.join(directory, entry.name));
    else if (entry.name.endsWith('.html')) {
      const file = path.join(directory, entry.name);
      const html = await readFile(file, 'utf8');
      const fixed = html.replace(/<script\b[^>]*\bsrc="\/_next\/[^>]*>/g, tag => tag.replace(/\sasync=""/, ' defer=""'));
      if (fixed !== html) await writeFile(file, fixed);
    }
  }
  if (directory === path.join(outputRoot, 'learn')) {
    // The course contains over a thousand exported lesson routes. Process a
    // bounded number of separate lesson trees at once to keep Windows I/O
    // quick without flooding the filesystem with every page simultaneously.
    for (let index = 0; index < directories.length; index += 12) {
      await Promise.all(directories.slice(index, index + 12).map(settle));
    }
  } else {
    for (const child of directories) await settle(child);
  }
}

async function flattenWindowsSegmentDirectory(routeDirectory, segmentDirectory) {
  const files = [];
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (entry.isFile() && entry.name.endsWith('.txt')) files.push(file);
    }
  }
  await collect(segmentDirectory);
  await Promise.all(files.map(async source => {
    const relative = path.relative(routeDirectory, source);
    const flatName = relative.replace(/[\\/]/g, '.');
    const destination = path.join(routeDirectory, flatName);
    try {
      await rename(source, destination);
    } catch (error) {
      if (error?.code !== 'EEXIST' && error?.code !== 'EPERM') throw error;
      const [existing, nested] = await Promise.all([readFile(destination), readFile(source)]);
      if (!existing.equals(nested)) throw new Error(`Conflicting static segment output: ${destination}`);
      await rm(source, { force: true });
    }
  }));
  await rm(segmentDirectory, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
await settle(outputRoot);
