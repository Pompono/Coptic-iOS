'use client';

import PageHeader from '../PageHeader';
import { useAuth } from '../AuthProvider';
import { useRouter } from 'next/navigation';
import Link from '@/lib/AppLink';
import AppIcon from '../AppIcon';
import Image from 'next/image';
import { COPTIC_KEYBOARD_APP_STORE_URL } from '../KeyboardInstallPrompt';
import { navigateSettings, rememberSettingsPush } from '@/lib/settingsNavigation';

const entries = [
  { href: '/settings/preferences', icon: 'sliders', color: 'learning', title: 'Preferences' },
  { href: '/settings/progress', icon: '↻', color: 'progress', title: 'Progress' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { loading, session } = useAuth();
  const displayName = String(session?.user.user_metadata?.display_name ?? '').trim() || session?.user.email || 'CoptLingo account';
  return <main className="app-page settings-page settings-home">
    <PageHeader title="Settings" icon="settings" />
    {loading ? <div className="settings-account-entry" role="status">Checking account…</div> : session ?
      <button className="settings-account-entry" type="button" onClick={() => { rememberSettingsPush('/settings/account?mode=settings'); navigateSettings(() => router.push('/settings/account?mode=settings'), 'forward', '/settings/account'); }} aria-label={`Account settings for ${displayName}`}>
        <span className="settings-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
        <span className="settings-account-entry__text"><strong>{displayName}</strong><span>{session.user.email}</span><small>{session.user.email_confirmed_at ? 'Email verified' : 'Email not verified'}</small></span>
        <span className="settings-chevron" aria-hidden="true">›</span>
      </button> :
      <button className="settings-account-entry settings-account-entry--guest" type="button" onClick={() => { rememberSettingsPush('/settings/account?mode=sign-in'); navigateSettings(() => router.push('/settings/account?mode=sign-in'), 'forward', '/settings/account'); }}>
        <span className="settings-avatar" aria-hidden="true">◉</span><span className="settings-account-entry__text"><strong>Sign In / Create Account</strong></span><span className="settings-chevron" aria-hidden="true">›</span>
      </button>}
    <nav className="settings-navigation" aria-label="Settings categories">
      {entries.map(item => <Link className="settings-navigation__row" href={item.href} key={item.href}>
        <span className={`settings-navigation__icon is-${item.color}`} aria-hidden="true">{item.icon === 'sliders' ? <AppIcon name="sliders" size={22}/> : item.icon}</span><span className="settings-navigation__copy"><strong>{item.title}</strong></span><span className="settings-chevron" aria-hidden="true">›</span>
      </Link>)}
    </nav>
    <section className="settings-keyboard-install" aria-labelledby="settings-keyboard-title">
      <h2 id="settings-keyboard-title">Coptic keyboard</h2>
      <div className="settings-keyboard-install__card">
        <p>Type with the iOS Coptic keyboard</p>
        <a href={COPTIC_KEYBOARD_APP_STORE_URL} target="_blank" rel="noreferrer" aria-label="Download the Coptic Keyboard app on the App Store">
          <Image src="/download-on-the-app-store-badge.svg" alt="Download on the App Store" width={160} height={54}/>
        </a>
      </div>
    </section>
  </main>;
}
