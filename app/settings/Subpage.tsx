'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import PageHeader, { PageBackLink } from '../PageHeader';
import ProgressSync from './ProgressSync';
import ProgressBackup from './ProgressBackup';
import { COPTIC_KEYBOARD_APP_STORE_URL } from '../KeyboardInstallPrompt';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { COPTIC_FONT_STORAGE_KEY, applyCopticFontMode, type CopticFontMode } from '../CopticFontPreference';
import { applyThemeMode, readThemePreference, THEME_STORAGE_KEY, type ThemeMode } from '../ThemePreference';
import { BOHAIRIC_ONLY_STORAGE_KEY, isBohairicOnlyEnabled } from '../BohairicPreference';
import { makeBackup, replaceRecords } from '@/lib/progressStorage';
import AccountPage from '../account/page';

function Shell({ title, children }: { title: string; children: ReactNode }) { return <main className="app-page settings-page settings-subpage"><PageBackLink href="/settings/">Settings</PageBackLink><PageHeader title={title} icon="settings"/>{children}</main>; }

function LearningSettings() {
  const [font, setFont] = useState<CopticFontMode>('avva'); const [theme, setTheme] = useState<ThemeMode>('system'); const [bohairic, setBohairic] = useState(true);
  useEffect(() => { try { setFont(localStorage.getItem(COPTIC_FONT_STORAGE_KEY) === 'unicode' ? 'unicode' : 'avva'); } catch {} setTheme(readThemePreference()); setBohairic(isBohairicOnlyEnabled()); }, []);
  function setFontMode(value: CopticFontMode) { setFont(value); localStorage.setItem(COPTIC_FONT_STORAGE_KEY, value); applyCopticFontMode(value); }
  function setThemeMode(value: ThemeMode) { setTheme(value); localStorage.setItem(THEME_STORAGE_KEY, value); applyThemeMode(value); }
  function setDialect(value: boolean) { setBohairic(value); localStorage.setItem(BOHAIRIC_ONLY_STORAGE_KEY, String(value)); window.dispatchEvent(new Event('coptic-settings-change')); }
  return <Shell title="Learning & Language"><section><h2 className="settings-section-title">Learning preferences</h2><div className="settings-group">
    <div className="settings-row"><label htmlFor="theme-choice">Appearance</label><select id="theme-choice" value={theme} onChange={event => setThemeMode(event.target.value as ThemeMode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
    <div className="settings-row"><label htmlFor="font-choice">Coptic font</label><select id="font-choice" value={font} onChange={event => setFontMode(event.target.value as CopticFontMode)}><option value="unicode">Standard</option><option value="avva">Avva Shenouda</option></select></div>
    <div className="settings-row"><span><label htmlFor="bohairic-switch">Bohairic-only mode</label><small className="settings-row-note">Use Bohairic entries and translator settings</small></span><input id="bohairic-switch" type="checkbox" className="ui-switch" role="switch" checked={bohairic} onChange={event => setDialect(event.target.checked)}/></div>
  </div></section></Shell>;
}

function KeyboardSettings() { return <Shell title="Keyboard"><section className="settings-group settings-group--content keyboard-resource"><p>Type Coptic with the optional Coptic Keyboard app.</p><a href={COPTIC_KEYBOARD_APP_STORE_URL} target="_blank" rel="noreferrer" aria-label="Download the Coptic Keyboard app on the App Store"><Image src="/download-on-the-app-store-badge.svg" alt="Download on the App Store" width={160} height={54}/></a></section></Shell>; }

export default function SettingsSubpage() {
  const pathname = usePathname(); const section = pathname.split('/').filter(Boolean).at(-1) ?? '';
  if (section === 'account') return <AccountPage/>;
  if (section === 'learning') return <LearningSettings/>;
  if (section === 'progress') return <Shell title="Progress"><ProgressSync/><ProgressBackup/></Shell>;
  if (section === 'keyboard') return <KeyboardSettings/>;
  if (section === 'developer') return <DeveloperSettings/>;
  return <Shell title="Settings"><p>That settings page is unavailable.</p></Shell>;
}

function DeveloperSettings() {
  const [message, setMessage] = useState('');
  if (process.env.NODE_ENV !== 'development') return <Shell title="Developer"><p>This page is available only in development builds.</p></Shell>;
  return <Shell title="Developer"><section className="settings-group settings-group--content"><h2>Development tools</h2><p>Destructive tools require confirmation. Recovery copies are retained by progress storage.</p><button className="ui-secondary" type="button" onClick={() => { if (!window.confirm('Reset all lesson progress, XP, and streak data on this device?')) return; try { const records = makeBackup().records; const retained = Object.fromEntries(Object.entries(records).filter(([key]) => key === 'coptic-vocabulary:v1' || key === 'coptic-reader:v1')); replaceRecords(retained); setMessage('Lesson progress reset. A recovery copy is available in Progress.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Reset failed.'); } }}>Reset lesson progress</button>{message && <p role="status">{message}</p>}</section></Shell>;
}
