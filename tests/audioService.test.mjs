import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

let platform = 'web';
const nativeCalls = [];
globalThis.__nativeAudioTest = {
  Capacitor: { getPlatform: () => platform },
  registerPlugin: () => ({
    activate: async () => nativeCalls.push('activate'),
    preload: async ({ path }) => { nativeCalls.push(['preload', path]); return { duration: 1.2 }; },
    play: async ({ path }) => { nativeCalls.push(['play', path]); return { duration: 1.2 }; },
    stop: async () => nativeCalls.push('stop')
  })
};
const source = (await readFile('lib/audioService.ts', 'utf8')).replace('import { Capacitor, registerPlugin } from "@capacitor/core";', 'const { Capacitor, registerPlugin } = globalThis.__nativeAudioTest;');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { audioService } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('audio resumes synchronously within the tap and recovers if suspended during loading', async () => {
  let context, resumeCount = 0, started = 0, completeFetch;
  class FakeContext {
    state = 'suspended'; destination = {}; sampleRate = 44100;
    constructor() { context = this; }
    resume() { resumeCount++; this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    decodeAudioData(_data, resolve) { const buffer = { duration: 1 }; resolve(buffer); return Promise.resolve(buffer); }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { assert.equal(context.state, 'running'); started++; }, stop() {} }; }
  }
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch;
  globalThis.window = { AudioContext: FakeContext };
  globalThis.fetch = () => new Promise(resolve => { completeFetch = resolve; });
  try {
    const play = audioService.play('test-pronunciation', '/test.wav');
    assert.equal(resumeCount, 1, 'resume occurs before yielding the user gesture');
    while (!completeFetch) await Promise.resolve();
    context.state = 'suspended';
    completeFetch({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await play;
    assert.equal(resumeCount, 2, 'resume again after an interruption during fetch');
    assert.equal(started, 1);
    await audioService.pause();
  } finally { globalThis.window = previousWindow; globalThis.fetch = previousFetch; }
});


test('iOS recordings use the native bundled player, preserving duration and stop behavior without Web Audio fetches', async () => {
  platform = 'ios';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Native playback must not fetch through the webview'); };
  try {
    await audioService.unlock();
    await audioService.preload('a', '/audio/learn/shared/a.wav');
    const playback = await audioService.play('a', '/audio/learn/shared/a.wav');
    assert.equal(playback.buffer.duration, 1.2);
    audioService.stopAll();
    await audioService.pause();
    assert.deepEqual(nativeCalls, ['activate', ['preload', '/audio/learn/shared/a.wav'], ['play', '/audio/learn/shared/a.wav'], 'stop', 'stop']);
  } finally { platform = 'web'; globalThis.fetch = previousFetch; delete globalThis.__nativeAudioTest; }
});
