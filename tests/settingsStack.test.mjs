import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTsModule } from './tsModule.mjs';
const stack = await loadTsModule('lib/settingsStack.ts');

test('edge intent yields to vertical, leftward, diagonal and small motion', () => {
  for (const [x, y] of [[0, 30], [-20, 0], [15, 12], [10, 20]]) assert.equal(stack.settingsDragIntent(x, y), 'reject');
  assert.equal(stack.settingsDragIntent(8, 2), 'wait');
  assert.equal(stack.settingsDragIntent(20, 5), 'back');
});
test('distance or recent forward velocity commits, short or reversed drags cancel', () => {
  assert.equal(stack.settingsDragCompletes(137, 390, 0), true);
  assert.equal(stack.settingsDragCompletes(136, 390, 0), false);
  assert.equal(stack.settingsDragCompletes(40, 390, .5), true);
  assert.equal(stack.settingsDragCompletes(39, 390, 1), false);
  assert.equal(stack.settingsDragCompletes(80, 390, -.8), false);
});
test('only validated Settings entries can supply scroll and traversal information', () => {
  const entry = { path: '/settings/progress', y: 45, trail: [{ path: '/settings', y: 80 }], session: 'test', index: 1 };
  assert.deepEqual(stack.readSettingsHistory(entry, entry.path), entry);
  for (const invalid of [null, { ...entry, y: NaN }, { ...entry, index: -1 }, { ...entry, trail: [{ path: '/learn', y: 0 }] }]) assert.equal(stack.readSettingsHistory(invalid, entry.path), null);
  assert.equal(stack.readSettingsHistory(entry, '/settings/account'), null);
  assert.equal(stack.settingsParent('/settings'), null);
  assert.equal(stack.settingsParent('/settings/recovery'), '/settings/progress');
});
test('the navigation implementation cannot introduce DOM snapshots or body-wide observers', async () => {
  for (const file of ['app/settings/SettingsNavigationHost.tsx', 'lib/settingsNavigation.ts', 'lib/settingsStack.ts']) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /cloneNode|MutationObserver|document\.body\.append|innerHTML|outerHTML/);
  }
});
