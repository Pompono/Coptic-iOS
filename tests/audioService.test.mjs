import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const code = ts.transpileModule(await readFile('lib/audioService.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
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
