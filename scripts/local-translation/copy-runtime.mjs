import { mkdir, readdir, copyFile } from 'node:fs/promises';
const destination = 'public/local-runtime';
await mkdir(destination, { recursive: true });
const source = 'node_modules/onnxruntime-web/dist';
for (const file of await readdir(source)) {
  if (file.startsWith('ort-wasm') && (file.endsWith('.mjs') || file.endsWith('.wasm'))) {
    await copyFile(`${source}/${file}`, `${destination}/${file}`);
    if (file.endsWith('.mjs')) {
      await copyFile(`${source}/${file}`, `${destination}/${file.replace(/\.mjs$/, '.js')}`);
    }
  }
}
