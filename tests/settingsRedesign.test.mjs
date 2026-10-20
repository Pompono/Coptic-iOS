import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const font = await import('../lib/copticFontPreference.mjs');
const [settingsHome, subpage, account, progress, recovery, progressStorage] = await Promise.all([
  readFile('app/settings/page.tsx', 'utf8'),
  readFile('app/settings/Subpage.tsx', 'utf8'),
  readFile('app/account/page.tsx', 'utf8'),
  readFile('app/settings/ProgressSync.tsx', 'utf8'),
  readFile('app/settings/ProgressBackup.tsx', 'utf8'),
  readFile('lib/progressStorage.ts', 'utf8'),
]);

test('Modern and Classic keep their original font implementations and saved values', () => {
  assert.deepEqual(font.COPTIC_FONT_OPTIONS, [
    { label: 'Modern', value: 'avva' },
    { label: 'Classic', value: 'unicode' },
  ]);
  assert.equal(font.COPTIC_FONT_STORAGE_KEY, 'coptic-font-mode');
  assert.equal(font.readCopticFontMode(null), 'avva');
  assert.equal(font.readCopticFontMode('avva'), 'avva');
  assert.equal(font.readCopticFontMode('unicode'), 'unicode');
  assert.match(subpage, /font-choice.*COPTIC_FONT_OPTIONS\.map/su);
});

test('Settings exposes one profile entry and exactly three primary categories', () => {
  assert.match(settingsHome, /href: '\/settings\/preferences',[^\n]*title: 'Preferences'/u);
  assert.match(settingsHome, /href: '\/settings\/progress',[^\n]*title: 'Progress'/u);
  assert.match(settingsHome, /href: '\/settings\/keyboard',[^\n]*title: 'Keyboard'/u);
  assert.doesNotMatch(settingsHome, /title: 'Account'/u);
  assert.doesNotMatch(settingsHome, /description:/u);
  assert.match(settingsHome, /router\.push\('\/settings\/account\?mode=settings'\)/u);
  assert.doesNotMatch(settingsHome, /Enable Cloud Sync/u);
});

test('Settings subpages share their back navigation and omit a sync toggle', () => {
  assert.match(subpage, /<PageBackLink href="\/settings\/">Settings<\/PageBackLink>/u);
  assert.match(subpage, /section === 'preferences'/u);
  assert.match(subpage, /<Shell title="Preferences"/u);
  assert.doesNotMatch(progress, /Enable Cloud Sync|settings-cloud-progress__toggle/u);
});

test('Account has one page title and enables save only for changed profile values', () => {
  assert.match(account, /<PageHeader title="Account"/u);
  assert.doesNotMatch(account, /formHeading|Account settings<\/h1>/u);
  assert.match(account, /disabled=\{busy \|\| !hasAccountChanges\}/u);
  assert.match(account, /service\.changeEmail\(newEmail\)/u);
  assert.match(account, /service\.signOut\(\)/u);
});

test('Recovery keeps distinct validated sources and asks before replacing progress', () => {
  assert.match(recovery, /CLOUD_SYNC_RECOVERY_KEY, RECOVERY_KEY/u);
  assert.match(recovery, /undoCloudSync\(\)|undoRestore\(\)/u);
  assert.match(recovery, /Replace current progress with the selected recovery copy/u);
  assert.match(progressStorage, /checkRecords\(data\.records, false\)/u);
  assert.match(progressStorage, /transaction\(storage, data\.records, null\)/u);
  assert.match(progressStorage, /replaceRecords\(data\.records, storage\)/u);
});
