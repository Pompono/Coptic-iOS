import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const calls = []; let failure; let writeFailure = false;
const filesystem = {
  Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
  Filesystem: {
    mkdir: async args => calls.push(['mkdir', args]),
    readdir: async () => ({ files: [
      { name: 'coptic-progress-old.json', type: 'file', mtime: 0 },
      { name: 'unrelated.json', type: 'file', mtime: 0 },
      { name: 'coptic-progress-new.json', type: 'file', mtime: Date.now() }
    ] }),
    deleteFile: async args => calls.push(['delete', args]),
    writeFile: async args => { calls.push(['write', args]); if (writeFailure) throw Error('disk full'); return { uri: 'file:///cache/' + args.path }; }
  }
};
globalThis.__progressFilesTest = { Capacitor: { isNativePlatform: () => true }, filesystem,
  share: { Share: { share: async args => { calls.push(['share', args]); if (failure) throw failure; return { activityType: 'saveToFiles' }; } } } };
const source = (await readFile('lib/progressFiles.ts', 'utf8'))
  .replace("import { Capacitor } from '@capacitor/core';", 'const { Capacitor } = globalThis.__progressFilesTest;')
  .replace("await import('@capacitor/filesystem')", 'globalThis.__progressFilesTest.filesystem')
  .replace("await import('@capacitor/share')", 'globalThis.__progressFilesTest.share');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { saveProgressFile } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('native export writes exact UTF-8 JSON and shares a .json file URL; only old owned files are pruned', async () => {
  calls.length = 0;
  const json = '{"word":"ⲱ\u0305ⲕ\u0301"}';
  assert.match(await saveProgressFile(json), /Share completed/);
  const write = calls.find(([kind]) => kind === 'write')[1];
  assert.equal(write.data, json); assert.equal(write.encoding, 'utf8'); assert.equal(write.directory, 'CACHE');
  assert.match(write.path, /^progress-backups\/coptic-progress-.*\.json$/);
  const share = calls.find(([kind]) => kind === 'share')[1];
  assert.deepEqual(share.files, ['file:///cache/' + write.path]);
  assert.deepEqual(calls.filter(([kind]) => kind === 'delete').map(([, args]) => args.path), ['progress-backups/coptic-progress-old.json']);
});
test('native share cancellation is a normal outcome, cleans its temp file and never claims an external save', async () => {
  calls.length = 0; failure = new Error('Share canceled');
  const result = await saveProgressFile('{}');
  assert.match(result, /Export cancelled/); assert.doesNotMatch(result, /Share completed/);
  assert.equal(calls.filter(([kind]) => kind === 'delete').length, 2);
  failure = undefined;
});
test('unexpected sharing and filesystem errors propagate without touching learning storage', async () => {
  calls.length = 0; failure = new Error('native bridge failed');
  await assert.rejects(saveProgressFile('{}'), /learning progress has not changed/);
  assert.equal(calls.filter(([kind]) => kind === 'delete').length, 2);
  failure = undefined; writeFailure = true; calls.length = 0;
  await assert.rejects(saveProgressFile('{}'), /disk full/);
  assert.equal(calls.some(([kind]) => kind === 'share'), false);
  writeFailure = false;
});
