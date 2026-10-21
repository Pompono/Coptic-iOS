import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const font = await import('../lib/copticFontPreference.mjs');
const [settingsHome, subpage, account, progress, recovery, progressStorage, learningPath] = await Promise.all([
  readFile('app/settings/page.tsx', 'utf8'),
  readFile('app/settings/Subpage.tsx', 'utf8'),
  readFile('app/account/page.tsx', 'utf8'),
  readFile('app/settings/ProgressSync.tsx', 'utf8'),
  readFile('app/settings/ProgressBackup.tsx', 'utf8'),
  readFile('lib/progressStorage.ts', 'utf8'),
  readFile('app/learn/[lessonId]/UnitProgressClient.tsx', 'utf8'),
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

test('Settings exposes one profile entry, two primary categories, and the keyboard download row', () => {
  assert.match(settingsHome, /href: '\/settings\/preferences',[^\n]*title: 'Preferences'/u);
  assert.match(settingsHome, /href: '\/settings\/progress',[^\n]*title: 'Progress'/u);
  assert.doesNotMatch(settingsHome, /href: '\/settings\/keyboard'/u);
  assert.match(settingsHome, /icon: 'sliders'/u);
  assert.match(settingsHome, /Coptic keyboard/u);
  assert.match(settingsHome, /Type with the iOS Coptic keyboard/u);
  assert.match(settingsHome, /COPTIC_KEYBOARD_APP_STORE_URL/u);
  assert.match(settingsHome, /download-on-the-app-store-badge\.svg/u);
  assert.doesNotMatch(subpage, /KeyboardSettings|section === 'keyboard'/u);
  assert.doesNotMatch(settingsHome, /title: 'Account'/u);
  assert.doesNotMatch(settingsHome, /description:/u);
  assert.match(settingsHome, /router\.push\('\/settings\/account\?mode=settings'\)/u);
  assert.doesNotMatch(settingsHome, /Enable Cloud Sync/u);
});

test('Settings subpages share their back navigation and omit a sync toggle', () => {
  assert.match(subpage, /PageBackLink href=\{backHref\}>\{backLabel\}<\/PageBackLink>/u);
  assert.match(subpage, /backHref = '\/settings\/', backLabel = 'Settings'/u);
  assert.match(subpage, /title="Recover progress" backHref="\/settings\/progress\/" backLabel="Progress"/u);
  assert.match(subpage, /section === 'preferences'/u);
  assert.match(subpage, /<Shell title="Preferences"/u);
  assert.doesNotMatch(progress, /Enable Cloud Sync|settings-cloud-progress__toggle/u);
});

test('The learning pathway uses its page name while preserving the unit map', () => {
  assert.match(learningPath, /PageHeader title="Learn"/u);
  assert.doesNotMatch(learningPath, /PageHeader title="CoptLingo"/u);
  assert.match(learningPath, /course-map-shell/u);
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
