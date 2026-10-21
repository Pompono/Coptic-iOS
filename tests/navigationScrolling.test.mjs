import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [globalStyles, designStyles, nativeController, navigation, appLink, header, recoveryPage] = await Promise.all([
  readFile('app/globals.css', 'utf8'),
  readFile('app/design-system.css', 'utf8'),
  readFile('ios/App/App/AppViewController.swift', 'utf8'),
  readFile('lib/settingsNavigation.ts', 'utf8'),
  readFile('lib/AppLink.tsx', 'utf8'),
  readFile('app/PageHeader.tsx', 'utf8'),
  readFile('app/settings/ProgressBackup.tsx', 'utf8'),
]);

test('Settings detail headers use shared spacing and one title-to-card gap', () => {
  assert.match(designStyles, /--settings-subpage-title-card-gap:24px/u);
  assert.match(designStyles, /\.settings-subpage>\.page-header\s*\{\s*margin:0 0 var\(--settings-subpage-title-card-gap\)/u);
  assert.doesNotMatch(designStyles, /settings-subpage>\.page-back\s*\{\s*margin-bottom:-/u);
  assert.match(header, /data-settings-direction="back"/u);
});

test('Settings navigation uses native View Transition snapshots and respects reduced motion', () => {
  assert.match(navigation, /startViewTransition\(\(\) =>/u);
  assert.match(navigation, /animateSettingsFallback\(update, direction, destination\)/u);
  assert.match(navigation, /source\.cloneNode\(true\)/u);
  assert.match(navigation, /prefers-reduced-motion: reduce/u);
  assert.match(appLink, /navigateSettings\(\(\) => router\.push/u);
  assert.match(appLink, /consumeSettingsBack\(href\)/u);
  assert.match(appLink, /canReturn \? router\.back\(\) : router\.replace\(href\)/u);
  assert.match(navigation, /rememberSettingsPush/u);
  assert.match(navigation, /transitionSettingsHistoryPop/u);
  assert.match(recoveryPage, /navigateSettings\(\(\) => router\.push\('\/settings\/recovery'\)/u);
  assert.match(designStyles, /settings-forward-old/u);
  assert.match(designStyles, /settings-back-old/u);
  assert.match(designStyles, /prefers-reduced-motion:reduce/u);
  assert.match(designStyles, /view-transition-name:settings-content/u);
});

test('Normal document scrolling leaves overscroll and momentum to the platform', () => {
  assert.match(globalStyles, /overscroll-behavior-y:\s*auto/u);
  assert.match(globalStyles, /-webkit-overflow-scrolling:\s*touch/u);
  assert.doesNotMatch(globalStyles, /overscroll-behavior:\s*none/u);
  assert.match(nativeController, /scrollView\.bounces = true/u);
  assert.match(nativeController, /scrollView\.alwaysBounceVertical = true/u);
  assert.match(nativeController, /scrollView\.alwaysBounceHorizontal = false/u);
});
