import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Capacitor serves a complete static document, not a streamed Next response.
// Let the browser finish parsing it before Next hydrates. Async boot scripts
// can run while head/body parsing is in progress and misplace hoisted metadata.
async function settle(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await settle(file);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      const fixed = html.replace(/<script\b[^>]*\bsrc="\/_next\/[^>]*>/g, tag => tag.replace(/\sasync=""/, ' defer=""'));
      if (fixed !== html) await writeFile(file, fixed);
    }
  }
}
await settle('out');
