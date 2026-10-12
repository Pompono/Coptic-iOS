import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const revision = '192d3199323afc34c66504c34ada837508a9ed07';
const source = `https://raw.githubusercontent.com/Shreeshrii/tessdata_coptic/${revision}`;
const sha256 = 'a7e623a7efcda22aab7710b86ae395a7557bd6effd483075509719f29c2f9adc';
const directory = 'public/ocr';
await mkdir(directory, { recursive: true });
const modelPath = `${directory}/cop.traineddata`;
let model = await readFile(modelPath).catch(() => null);
if (!model || createHash('sha256').update(model).digest('hex') !== sha256) {
  // curl respects the managed build environment's proxy and CA trust.
  execFileSync('curl', ['--fail', '--location', '--retry', '3', '--max-time', '120', `${source}/cop.traineddata`, '-o', modelPath], { stdio: 'inherit' });
  model = await readFile(modelPath);
}
if (createHash('sha256').update(model).digest('hex') !== sha256) throw new Error('Coptic OCR model checksum mismatch.');
await copyFile('node_modules/tesseract.js/dist/worker.min.js', `${directory}/worker.min.js`);
for (const variant of ['lstm', 'simd-lstm']) {
  for (const extension of ['wasm', 'wasm.js']) {
    const file = `tesseract-core-${variant}.${extension}`;
    await copyFile(`node_modules/tesseract.js-core/${file}`, `${directory}/${file}`);
  }
}
await copyFile('node_modules/tesseract.js/LICENSE.md', `${directory}/LICENSE.tesseract-js.txt`);
await copyFile('node_modules/tesseract.js-core/LICENSE', `${directory}/LICENSE.tesseract-core.txt`);
await writeFile(`${directory}/SOURCE.txt`, `Experimental Coptic OCR model: Shreeshrii/tessdata_coptic\nRevision: ${revision}\nSource: ${source}/cop.traineddata\nSHA-256: ${sha256}\nUpstream does not specify a model license. No license is inferred. Clarify redistribution rights before public distribution.\nTesseract.js and its core have their separate bundled licenses.\n`);
await writeFile(`${directory}/manifest.json`, JSON.stringify({ language: 'cop', source: 'Shreeshrii/tessdata_coptic', revision, sha256, bytes: model.length }, null, 2));
console.log(`Prepared bundled Coptic OCR (${(model.length / 1e6).toFixed(1)} MB model).`);
