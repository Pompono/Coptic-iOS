import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

// Check the generated WebView payload without reading environment variables or
// secret files. Never print a matching value or its surrounding content.
const root = process.argv[2] || 'out';
let files = 0;
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else {
      assert.ok(!/\.onnx(?:_data)?$|ort-wasm/i.test(file), `Inference runtime or weights in release export: ${file}`);
      const data = await readFile(file);
      for (const forbidden of ['COPTIC_API_KEY', 'NEXT_PUBLIC_TRANSLATION_API_URL', 'api.coptlingo.com', '-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----']) {
        assert.ok(!data.includes(forbidden), `Forbidden private/configuration reference in exported asset: ${file}`);
      }
      files++;
    }
  }
}
for (const removed of ['models/coptic-english', 'local-runtime'].map(file => path.join(root, file))) {
  await assert.rejects(access(removed), { code: 'ENOENT' });
}
for (const kept of ['ocr/cop.traineddata', 'ocr/tesseract-core-simd-lstm.wasm', 'reference-translation/bohairic.json', 'bohairic_dictionary.json', 'audio/learn/shared/a.wav'].map(file => path.join(root, file))) await access(kept);
await scan(root);
console.log(`PASS: ${files} exported files checked for private translation configuration and private-key markers. No secret values were read.`);
