import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

let platform = 'web', resolveChange;
const calls = [];
globalThis.__iconTestBridge = {
  Capacitor: { getPlatform: () => platform },
  registerPlugin: () => ({ setTheme: ({ theme }) => {
    calls.push(theme);
    return new Promise(resolve => { resolveChange = resolve; });
  } })
};
const source = (await readFile('lib/nativeAppIcon.ts', 'utf8')).replace("import { Capacitor, registerPlugin } from '@capacitor/core';", 'const { Capacitor, registerPlugin } = globalThis.__iconTestBridge;');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { syncNativeAppIcon } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('web theme changes do not call native APIs; rapid iOS changes finish at the latest theme', async () => {
  await syncNativeAppIcon('dark');
  assert.deepEqual(calls, []);
  platform = 'ios';
  const first = syncNativeAppIcon('dark');
  syncNativeAppIcon('light');
  syncNativeAppIcon('dark');
  syncNativeAppIcon('light');
  assert.deepEqual(calls, ['dark']);
  resolveChange();
  await Promise.resolve();
  assert.deepEqual(calls, ['dark', 'light']);
  resolveChange();
  await first;
  const next = syncNativeAppIcon('dark');
  assert.deepEqual(calls, ['dark', 'light', 'dark']);
  resolveChange();
  await next;
  delete globalThis.__iconTestBridge;
});
