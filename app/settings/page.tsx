'use client';

import PageHeader from '../PageHeader';
import { useAuth } from '../AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const entries = [
  { href: '/settings/preferences', icon: '文', color: 'learning', title: 'Preferences' },
  { href: '/settings/progress', icon: '↻', color: 'progress', title: 'Progress' },
  { href: '/settings/keyboard', icon: '⌨', color: 'keyboard', title: 'Keyboard' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { loading, session } = useAuth();
  const displayName = String(session?.user.user_metadata?.display_name ?? '').trim() || session?.user.email || 'CoptLingo account';
  return <main className="app-page settings-page settings-home">
    <PageHeader title="Settings" icon="settings" />
    {loading ? <div className="settings-account-entry" role="status">Checking account…</div> : session ?
      <button className="settings-account-entry" type="button" onClick={() => router.push('/settings/account?mode=settings')} aria-label={`Account settings for ${displayName}`}>
        <span className="settings-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
        <span className="settings-account-entry__text"><strong>{displayName}</strong><span>{session.user.email}</span><small>{session.user.email_confirmed_at ? 'Email verified' : 'Email not verified'}</small></span>
        <span className="settings-chevron" aria-hidden="true">›</span>
      </button> :
      <button className="settings-account-entry settings-account-entry--guest" type="button" onClick={() => router.push('/settings/account?mode=sign-in')}>
        <span className="settings-avatar" aria-hidden="true">◉</span><span className="settings-account-entry__text"><strong>Sign In / Create Account</strong></span><span className="settings-chevron" aria-hidden="true">›</span>
      </button>}
    <nav className="settings-navigation" aria-label="Settings categories">
      {entries.map(item => <Link className="settings-navigation__row" href={item.href} key={item.href}>
        <span className={`settings-navigation__icon is-${item.color}`} aria-hidden="true">{item.icon}</span><span className="settings-navigation__copy"><strong>{item.title}</strong></span><span className="settings-chevron" aria-hidden="true">›</span>
      </Link>)}
    </nav>
  </main>;
}
