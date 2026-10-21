'use client';


import type { ReactNode } from 'react';
import PageHeader, { PageBackLink } from '../PageHeader';
import ProgressSync from './ProgressSync';
import ProgressBackup from './ProgressBackup';
import { useEffect, useState } from 'react';
import { COPTIC_FONT_OPTIONS, COPTIC_FONT_STORAGE_KEY, applyCopticFontMode, readCopticFontMode, type CopticFontMode } from '../CopticFontPreference';
import { applyThemeMode, readThemePreference, THEME_STORAGE_KEY, type ThemeMode } from '../ThemePreference';
import { BOHAIRIC_ONLY_STORAGE_KEY, isBohairicOnlyEnabled } from '../BohairicPreference';
import { makeBackup, replaceRecords } from '@/lib/progressStorage';
import AccountPage from '../account/page';

function Shell({ title, children, backHref = '/settings/', backLabel = 'Settings' }: { title: string; children: ReactNode; backHref?: string; backLabel?: string }) { return <main className="app-page settings-page settings-subpage"><PageBackLink href={backHref}>{backLabel}</PageBackLink><PageHeader title={title} icon="settings"/>{children}</main>; }

function LearningSettings() {
  const [font, setFont] = useState<CopticFontMode>('avva'); const [theme, setTheme] = useState<ThemeMode>('system'); const [bohairic, setBohairic] = useState(true);
  useEffect(() => { try { setFont(readCopticFontMode(localStorage.getItem(COPTIC_FONT_STORAGE_KEY))); } catch {} setTheme(readThemePreference()); setBohairic(isBohairicOnlyEnabled()); }, []);
  function setFontMode(value: CopticFontMode) { setFont(value); localStorage.setItem(COPTIC_FONT_STORAGE_KEY, value); applyCopticFontMode(value); }
  function setThemeMode(value: ThemeMode) { setTheme(value); localStorage.setItem(THEME_STORAGE_KEY, value); applyThemeMode(value); }
  function setDialect(value: boolean) { setBohairic(value); localStorage.setItem(BOHAIRIC_ONLY_STORAGE_KEY, String(value)); window.dispatchEvent(new Event('coptic-settings-change')); }
  return <Shell title="Preferences"><section><div className="settings-group">
    <div className="settings-row"><label htmlFor="theme-choice">Appearance</label><select id="theme-choice" value={theme} onChange={event => setThemeMode(event.target.value as ThemeMode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
    <div className="settings-row"><label htmlFor="font-choice">Coptic font</label><select id="font-choice" aria-label="Coptic font" value={font} onChange={event => setFontMode(event.target.value as CopticFontMode)}>{COPTIC_FONT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
    <div className="settings-row"><label htmlFor="bohairic-switch">Bohairic-only mode</label><input id="bohairic-switch" type="checkbox" className="ui-switch" role="switch" checked={bohairic} onChange={event => setDialect(event.target.checked)}/></div>
  </div></section></Shell>;
}

export default function SettingsSubpage({ section, preview = false }: { section: string; preview?: boolean }) {
  if (section === 'account') return <AccountPage/>;
  if (section === 'learning' || section === 'preferences') return <LearningSettings/>;
  if (section === 'progress') return <Shell title="Progress"><ProgressSync active={!preview}/><ProgressBackup/></Shell>;
  if (section === 'recovery') return <Shell title="Recover progress" backHref="/settings/progress/" backLabel="Progress"><ProgressBackup focused/></Shell>;
  if (section === 'developer') return <DeveloperSettings/>;
  return <Shell title="Settings"><p>That settings page is unavailable.</p></Shell>;
}

function DeveloperSettings() {
  const [message, setMessage] = useState('');
  if (process.env.NODE_ENV !== 'development') return <Shell title="Developer"><p>This page is available only in development builds.</p></Shell>;
  return <Shell title="Developer"><section className="settings-group settings-group--content"><h2>Development tools</h2><p>Destructive tools require confirmation. Recovery copies are retained by progress storage.</p><button className="ui-secondary" type="button" onClick={() => { if (!window.confirm('Reset all lesson progress, XP, and streak data on this device?')) return; try { const records = makeBackup().records; const retained = Object.fromEntries(Object.entries(records).filter(([key]) => key === 'coptic-vocabulary:v1' || key === 'coptic-reader:v1')); replaceRecords(retained); setMessage('Lesson progress reset. A recovery copy is available in Progress.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Reset failed.'); } }}>Reset lesson progress</button>{message && <p role="status">{message}</p>}</section></Shell>;
}

