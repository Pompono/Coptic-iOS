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

test('Settings uses direct route updates without snapshots, observers, or transition overlays', () => {
  assert.doesNotMatch(navigation, /cloneNode|MutationObserver|\.animate\(|requestAnimationFrame|data-settings-snapshot/u);
  assert.match(navigation, /export function navigateSettings\(update: \(\) => void\)\s*\{\s*update\(\);\s*\}/u);
  assert.match(navigation, /export function leaveSettingsNavigation/u);
  assert.match(appLink, /navigateSettings\(\(\) => router\.push/u);
  assert.match(appLink, /consumeSettingsBack\(href\)/u);
  assert.match(appLink, /canReturn \? router\.back\(\) : router\.replace\(href\)/u);
  assert.match(appLink, /leaveSettingsNavigation\(\)/u);
  assert.match(navigation, /rememberSettingsPush/u);
  assert.match(navigation, /recordSettingsHistoryPop/u);
  assert.match(recoveryPage, /navigateSettings\(\(\) => router\.push\('\/settings\/recovery'\)\)/u);
  assert.match(navigation, /recordSettingsHistoryPop/u);
});

test('The document canvas matches the native scrolling surfaces in both app themes', () => {
  assert.match(globalStyles, /html,\s*body\s*\{\s*min-height:\s*100%;\s*background-color:\s*var\(--bg-color\)/u);
  assert.match(nativeController, /setWebViewBackground/gu);
  assert.match(nativeController, /webView\.backgroundColor = color/u);
  assert.match(nativeController, /webView\.scrollView\.backgroundColor = color/u);
  assert.match(nativeController, /244 \/ 255/u);
  assert.match(nativeController, /8 \/ 255/u);
});

test('Normal document scrolling leaves overscroll and momentum to the platform', () => {
  assert.match(globalStyles, /overscroll-behavior-y:\s*auto/u);
  assert.match(globalStyles, /-webkit-overflow-scrolling:\s*touch/u);
  assert.doesNotMatch(globalStyles, /overscroll-behavior:\s*none/u);
  assert.match(nativeController, /scrollView\.bounces = true/u);
  assert.match(nativeController, /scrollView\.alwaysBounceVertical = true/u);
  assert.match(nativeController, /scrollView\.alwaysBounceHorizontal = false/u);
});
