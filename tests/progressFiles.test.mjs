import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const calls = [];
const filesOnDisk = new Map();
let failure;
let writeFailure = false;
let shareHook;
const filesystem = {
  Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
  Filesystem: {
    mkdir: async args => calls.push(['mkdir', args]),
    readdir: async () => ({ files: [
      { name: 'coptic-progress-old.json', type: 'file', mtime: 0 },
      { name: 'unrelated.json', type: 'file', mtime: 0 },
      { name: 'coptic-progress-new.json', type: 'file', mtime: Date.now() }
    ] }),
    deleteFile: async args => { calls.push(['delete', args]); filesOnDisk.delete(args.path); },
    writeFile: async args => {
      calls.push(['write', args]);
      if (writeFailure) throw Error('disk full');
      if (filesOnDisk.has(args.path)) throw Error('File already exists');
      filesOnDisk.set(args.path, args.data);
      return { uri: 'file:///cache/' + args.path };
    }
  }
};
globalThis.__progressFilesTest = { Capacitor: { isNativePlatform: () => true }, filesystem,
  share: { Share: { share: async args => {
    calls.push(['share', args]);
    await shareHook?.(args);
    if (failure) throw failure;
    return { activityType: 'saveToFiles' };
  } } } };
const source = (await readFile('lib/progressFiles.ts', 'utf8'))
  .replace("import { Capacitor } from '@capacitor/core';", 'const { Capacitor } = globalThis.__progressFilesTest;')
  .replace("await import('@capacitor/filesystem')", 'globalThis.__progressFilesTest.filesystem')
  .replace("await import('@capacitor/share')", 'globalThis.__progressFilesTest.share');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { saveProgressFile } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('repeated same-second exports use unique paths, preserve valid Unicode JSON and clean after share settles', async () => {
  calls.length = 0;
  const json = JSON.stringify({ word: 'ⲱ\u0305ⲕ\u0301', nested: { ok: true } });
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-17T12:00:00.000Z'])); } static now() { return RealDate.parse('2026-10-17T12:00:00.000Z'); } };
  try {
    assert.match(await saveProgressFile(json), /Export shared/);
    assert.match(await saveProgressFile(json), /Export shared/);
  } finally { globalThis.Date = RealDate; }
  const writes = calls.filter(([kind]) => kind === 'write').map(([, args]) => args);
  assert.equal(writes.length, 2);
  assert.notEqual(writes[0].path, writes[1].path);
  for (const write of writes) {
    assert.equal(write.data, json);
    assert.deepEqual(JSON.parse(write.data), JSON.parse(json));
    assert.equal(write.encoding, 'utf8');
    assert.equal(write.directory, 'CACHE');
    assert.match(write.path, /^progress-backups\/coptic-progress-.*\.json$/);
  }
  assert.deepEqual(calls.filter(([kind]) => kind === 'share').map(([, args]) => args.files[0]), writes.map(write => 'file:///cache/' + write.path));
  const deleted = calls.filter(([kind]) => kind === 'delete').map(([, args]) => args.path);
  for (const write of writes) assert.equal(deleted.includes(write.path), true);
  assert.equal(deleted.filter(path => path === 'progress-backups/coptic-progress-old.json').length, 2);
});

test('an existing temporary file does not block a new export', async () => {
  calls.length = 0;
  filesOnDisk.set('progress-backups/coptic-progress-existing.json', 'older backup');
  await saveProgressFile('{}');
  const write = calls.find(([kind]) => kind === 'write')[1];
  assert.notEqual(write.path, 'progress-backups/coptic-progress-existing.json');
  assert.equal(filesOnDisk.get('progress-backups/coptic-progress-existing.json'), 'older backup');
});

test('cancelled exports are reported as cancelled and cleaned after the native sheet closes', async () => {
  calls.length = 0; failure = new Error('Share canceled');
  const result = await saveProgressFile('{}');
  assert.match(result, /Export cancelled/);
  assert.match(result, /No file was saved/);
  assert.equal(calls.filter(([kind]) => kind === 'delete').filter(([, args]) => args.path !== 'progress-backups/coptic-progress-old.json').length, 1);
  failure = undefined;
});

test('share failure and filesystem failure provide actionable errors and do not touch learning storage', async () => {
  calls.length = 0; failure = new Error('native bridge failed');
  await assert.rejects(saveProgressFile('{}'), /Could not open the iOS save or share sheet.*learning progress is unchanged/);
  assert.equal(calls.filter(([kind]) => kind === 'delete').filter(([, args]) => args.path !== 'progress-backups/coptic-progress-old.json').length, 1);
  failure = undefined; writeFailure = true; calls.length = 0;
  await assert.rejects(saveProgressFile('{}'), /disk full/);
  assert.equal(calls.some(([kind]) => kind === 'share'), false);
  writeFailure = false;
});

test('temporary source remains available until Share resolves and is then cleaned up', async () => {
  calls.length = 0;
  failure = undefined;
  shareHook = async args => {
    const path = args.files[0].replace('file:///cache/', '');
    assert.equal(filesOnDisk.has(path), true);
  };
  await saveProgressFile('{}');
  shareHook = undefined;
  const path = calls.find(([kind]) => kind === 'write')[1].path;
  assert.equal(filesOnDisk.has(path), false);
});
