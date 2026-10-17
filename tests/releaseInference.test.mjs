import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, access, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('release pruning removes stale exported weights/runtime while preserving source tools and OCR/content', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'coptic-release-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const file of ['out/models/coptic-english/model.onnx', 'out/local-runtime/ort-wasm.wasm',
    'out/ocr/cop.traineddata', 'out/ocr/tesseract-core.wasm', 'out/reference-translation/bohairic.json',
    'out/audio/lesson.wav', 'public/models/coptic-english/model.onnx']) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), 'fixture');
  }
  const result = spawnSync(process.execPath, [path.resolve('scripts/prune-release-inference.mjs')], { cwd: dir });
  assert.equal(result.status, 0);
  for (const file of ['out/models/coptic-english/model.onnx', 'out/local-runtime/ort-wasm.wasm']) await assert.rejects(access(path.join(dir, file)));
  for (const file of ['out/ocr/cop.traineddata', 'out/ocr/tesseract-core.wasm', 'out/reference-translation/bohairic.json', 'out/audio/lesson.wav', 'public/models/coptic-english/model.onnx']) await access(path.join(dir, file));
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.doesNotMatch(pkg.scripts.prebuild, /copy-runtime/);
  assert.match(pkg.scripts.postbuild, /prune-release-inference/);
  assert.ok(!pkg.dependencies['@huggingface/transformers']);
  assert.ok(pkg.devDependencies['@huggingface/transformers']);
});

test('every reachable app import/worker is free of local AI dependencies', async () => {
  const roots = [];
  async function collect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (/\.(?:ts|tsx|mjs|js)$/.test(file)) roots.push(file);
    }
  }
  await collect('app');
  const visited = new Set();
  async function walk(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /@huggingface|onnxruntime|localTranslation\/(?:client|worker|decode|beamSearch)/, file);
    const refs = [...source.matchAll(/(?:from\s*|import\s*\(|new URL\s*\()\s*['"]([^'"]+)['"]/g)];
    for (const [, ref] of refs) {
      if (!ref.startsWith('.') && !ref.startsWith('@/')) continue;
      const base = ref.startsWith('@/') ? path.resolve(ref.slice(2)) : path.resolve(path.dirname(file), ref);
      const candidates = path.extname(base) ? [base] : [base + '.ts', base + '.tsx', base + '.mjs', base + '.js', path.join(base, 'index.ts')];
      for (const candidate of candidates) {
        if (!/\.(?:ts|tsx|mjs|js)$/.test(candidate)) continue;
        if (await access(candidate).then(() => true).catch(() => false)) { await walk(candidate); break; }
      }
    }
  }
  for (const file of roots) await walk(path.resolve(file));
  assert.ok([...visited].some(file => file.endsWith('scanner/sourceWorker.ts')));
  assert.ok([...visited].some(file => file.endsWith('localTranslation/referenceClient.ts')));
});
