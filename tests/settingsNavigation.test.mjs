import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTsModule } from './tsModule.mjs';

test('Settings history commits routes once and handles Back, Forward, and tab changes', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: { href: 'https://coptic.test/settings/', pathname: '/settings' },
  };
  try {
    const navigation = await loadTsModule('lib/settingsNavigation.ts');
    navigation.recordSettingsRoute('/settings');

    navigation.rememberSettingsPush('/settings/preferences');
    globalThis.window.location.pathname = '/settings/preferences';
    navigation.recordSettingsRoute('/settings/preferences');
    assert.equal(navigation.consumeSettingsBack('/settings'), true);

    navigation.rememberSettingsPush('/settings/preferences');
    navigation.rememberSettingsPush('/settings/progress');
    globalThis.window.location.pathname = '/settings/progress';
    navigation.recordSettingsRoute('/settings/progress');
    assert.equal(navigation.consumeSettingsBack('/settings'), true, 'two taps before a route commit create one Back destination');

    globalThis.window.location.pathname = '/settings';
    navigation.recordSettingsRoute('/settings');
    globalThis.window.location.pathname = '/settings/progress';
    navigation.recordSettingsHistoryPop();
    assert.equal(navigation.consumeSettingsBack('/settings'), true, 'browser Forward restores the route stack hint');

    navigation.leaveSettingsNavigation();
    assert.equal(navigation.consumeSettingsBack('/settings'), false, 'tab navigation clears stale Settings entries');
    let updated = false;
    navigation.navigateSettings(() => { updated = true; });
    assert.equal(updated, true, 'the unanimated fallback still performs route updates');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
