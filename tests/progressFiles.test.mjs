import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const calls = [];
const filesOnDisk = new Map();
const directoriesOnDisk = new Set();
const learningProgress = new Map([['coptic-progress', '{"xp":42,"completedLessons":["lesson-1"]}']]);
let failure;
let writeFailure;
let mkdirFailure;
let statFailure;
let mkdirHook;
let shareHook;
const folder = 'progress-backups';
const filesystem = {
  Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' },
  Filesystem: {
    stat: async args => {
      calls.push(['stat', args]);
      if (statFailure) throw statFailure;
      if (directoriesOnDisk.has(args.path)) return { type: 'directory', size: 0, mtime: Date.now(), uri: 'file:///cache/' + args.path };
      if (filesOnDisk.has(args.path)) return { type: 'file', size: filesOnDisk.get(args.path).length, mtime: Date.now(), uri: 'file:///cache/' + args.path };
      throw Object.assign(new Error('Path does not exist'), { code: 'ENOENT' });
    },
    mkdir: async args => {
      calls.push(['mkdir', args]);
      await mkdirHook?.(args);
      if (mkdirFailure) throw mkdirFailure;
      if (directoriesOnDisk.has(args.path)) throw Error('Directory already exists, cannot be overwritten');
      if (filesOnDisk.has(args.path)) throw Error('File already exists');
      directoriesOnDisk.add(args.path);
    },
    readdir: async () => ({ files: [
      { name: 'coptic-progress-old.json', type: 'file', mtime: 0 },
      { name: 'unrelated.json', type: 'file', mtime: 0 },
      { name: 'coptic-progress-new.json', type: 'file', mtime: Date.now() }
    ] }),
    deleteFile: async args => { calls.push(['delete', args]); filesOnDisk.delete(args.path); },
    writeFile: async args => {
      calls.push(['write', args]);
      if (writeFailure) throw writeFailure;
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
let moduleNumber = 0;
async function loadSaveProgressFile() {
  moduleNumber += 1;
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#instance-${moduleNumber}`)).saveProgressFile;
}
const saveProgressFile = await loadSaveProgressFile();

test('first export creates its missing directory', async () => {
  calls.length = 0;
  directoriesOnDisk.delete(folder);
  const result = await saveProgressFile('{}');
  assert.match(result, /Export shared/);
  assert.equal(directoriesOnDisk.has(folder), true);
  assert.equal(calls.filter(([kind]) => kind === 'mkdir').length, 1);
});

test('second and later exports reuse the existing directory', async () => {
  calls.length = 0;
  const save = await loadSaveProgressFile();
  await save('{}'); await save('{}'); await save('{}');
  assert.equal(calls.filter(([kind]) => kind === 'mkdir').length, 0);
  assert.equal(calls.filter(([kind]) => kind === 'stat').length, 3);
});

test('an app restart reuses the directory persisted by the filesystem', async () => {
  calls.length = 0;
  assert.equal(directoriesOnDisk.has(folder), true);
  const saveAfterRestart = await loadSaveProgressFile();
  await saveAfterRestart('{}');
  assert.equal(calls.filter(([kind]) => kind === 'mkdir').length, 0);
});

test('a concurrent directory creation race is accepted only after stat verifies the directory', async () => {
  calls.length = 0;
  directoriesOnDisk.delete(folder);
  mkdirHook = async args => { directoriesOnDisk.add(args.path); };
  const save = await loadSaveProgressFile();
  await save('{}');
  mkdirHook = undefined;
  assert.equal(calls.filter(([kind]) => kind === 'mkdir').length, 1);
  assert.equal(calls.filter(([kind]) => kind === 'stat').length, 2);
  assert.equal(calls.some(([kind]) => kind === 'share'), true);
});

test('a conflicting regular file produces a clear error and does not change progress', async () => {
  calls.length = 0;
  directoriesOnDisk.delete(folder);
  filesOnDisk.set(folder, 'conflicting file');
  const progressBefore = new Map(learningProgress);
  const save = await loadSaveProgressFile();
  await assert.rejects(save('{}'), /'progress-backups' is a file, not a folder.*Remove or rename/);
  assert.equal(calls.some(([kind]) => kind === 'mkdir' || kind === 'write' || kind === 'share'), false);
  assert.deepEqual(learningProgress, progressBefore);
  filesOnDisk.delete(folder);
});

test('permission and storage failures are reported and leave progress untouched', async () => {
  const progressBefore = new Map(learningProgress);
  directoriesOnDisk.delete(folder);
  statFailure = Error('permission denied'); mkdirFailure = Error('no space left on device'); calls.length = 0;
  const save = await loadSaveProgressFile();
  try {
    await assert.rejects(save('{}'), /Could not prepare the progress backup folder.*storage access.*free space.*no space left on device.*permission denied/i);
  } finally { statFailure = undefined; mkdirFailure = undefined; }
  assert.equal(calls.some(([kind]) => kind === 'share' || kind === 'write'), false);
  assert.deepEqual(learningProgress, progressBefore);
});

test('repeated same-second exports use unique paths and preserve exact Unicode JSON bytes', async () => {
  calls.length = 0;
  const json = JSON.stringify({ format: 'coptic-progress-backup', word: 'ⲱ\u0305ⲕ\u0301', nested: { xp: 42 } });
  const RealDate = globalThis.Date;
  globalThis.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-17T12:00:00.000Z'])); } static now() { return RealDate.parse('2026-10-17T12:00:00.000Z'); } };
  try {
    const save = await loadSaveProgressFile();
    assert.match(await save(json), /Export shared/);
    assert.match(await save(json), /Export shared/);
  } finally { globalThis.Date = RealDate; }
  const writes = calls.filter(([kind]) => kind === 'write').map(([, args]) => args);
  assert.equal(writes.length, 2);
  assert.notEqual(writes[0].path, writes[1].path);
  for (const write of writes) {
    assert.equal(write.data, json);
    assert.deepEqual(JSON.parse(write.data), JSON.parse(json));
    assert.equal(write.encoding, 'utf8');
    assert.equal(write.directory, 'CACHE');
  }
});

test('cancelled exports are reported as cancelled and cleaned after the native sheet closes', async () => {
  calls.length = 0; failure = new Error('Share canceled');
  const save = await loadSaveProgressFile();
  const result = await save('{}');
  assert.match(result, /Export cancelled/);
  assert.match(result, /No file was saved/);
  failure = undefined;
});

test('share failures and write failures are actionable and never alter learning progress', async () => {
  const progressBefore = new Map(learningProgress);
  calls.length = 0; failure = new Error('native bridge failed');
  const save = await loadSaveProgressFile();
  await assert.rejects(save('{}'), /Could not open the iOS save or share sheet.*learning progress is unchanged/);
  assert.equal(calls.filter(([kind]) => kind === 'delete').some(([, args]) => args.path.startsWith(folder + '/')), true);
  failure = undefined; writeFailure = Error('disk full'); calls.length = 0;
  await assert.rejects(save('{}'), /disk full/);
  assert.equal(calls.some(([kind]) => kind === 'share'), false);
  assert.deepEqual(learningProgress, progressBefore);
  writeFailure = undefined;
});

test('temporary source remains until Share resolves, then cleanup removes it', async () => {
  calls.length = 0; failure = undefined;
  shareHook = async args => {
    const path = args.files[0].replace('file:///cache/', '');
    assert.equal(filesOnDisk.has(path), true);
  };
  const save = await loadSaveProgressFile();
  await save('{}');
  shareHook = undefined;
  const path = calls.find(([kind]) => kind === 'write')[1].path;
  assert.equal(filesOnDisk.has(path), false);
});
