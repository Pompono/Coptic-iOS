import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Check the generated WebView payload without reading environment variables or
// secret files. Never print a matching value or its surrounding content.
let files = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else {
      const data = await readFile(file);
      for (const forbidden of ['COPTIC_API_KEY', 'NEXT_PUBLIC_TRANSLATION_API_URL', 'api.coptlingo.com', '-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----']) {
        assert.ok(!data.includes(forbidden), `Forbidden private/configuration reference in exported asset: ${file}`);
      }
      files++;
    }
  }
}
await scan('out');
console.log(`PASS: ${files} exported files checked for private translation configuration and private-key markers. No secret values were read.`);
