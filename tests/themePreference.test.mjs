import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createThemeInitScript, readThemeMode, resolveTheme } from '../lib/themePreference.mjs';

test('missing and legacy appearance preferences remain compatible', () => {
  assert.equal(readThemeMode(null), 'system');
  assert.equal(readThemeMode('light'), 'light');
  assert.equal(readThemeMode('dark'), 'dark');
  assert.equal(readThemeMode('system'), 'system');
  assert.equal(readThemeMode('unexpected'), 'system');
});

test('system appearance follows the current device while explicit choices stay fixed', () => {
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('startup script applies legacy and system preferences before rendering', () => {
  for (const [saved, systemDark, expectedTheme] of [
    [null, true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', false, 'light'],
  ]) {
    const dataset = {};
    vm.runInNewContext(createThemeInitScript(), {
      localStorage: { getItem: () => saved },
      window: { matchMedia: () => ({ matches: systemDark }) },
      document: { documentElement: { dataset } },
    });
    assert.equal(dataset.theme, expectedTheme);
  }
});
