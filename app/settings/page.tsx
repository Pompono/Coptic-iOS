'use client';

import PageHeader from '../PageHeader';
import { useAuth } from '../AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const entries = [
  { href: '/settings/account', icon: '◉', color: 'account', title: 'Account', description: 'Profile, password, and account access' },
  { href: '/settings/learning', icon: '文', color: 'learning', title: 'Learning & Language', description: 'Appearance, Coptic font, and dialect' },
  { href: '/settings/progress', icon: '↻', color: 'progress', title: 'Progress', description: 'Cloud sync and recovery' },
  { href: '/settings/keyboard', icon: '⌨', color: 'keyboard', title: 'Keyboard', description: 'Type Coptic on your device' },
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
      <button className="settings-account-entry settings-account-entry--guest" type="button" onClick={() => router.push('/settings/account')}>
        <span className="settings-avatar" aria-hidden="true">◉</span><span className="settings-account-entry__text"><strong>Sign in or create an account</strong><span>Optional account with cloud progress sync</span></span><span className="settings-chevron" aria-hidden="true">›</span>
      </button>}
    <nav className="settings-navigation" aria-label="Settings categories">
      {entries.map(item => <Link className="settings-navigation__row" href={item.href} key={item.href}>
        <span className={`settings-navigation__icon is-${item.color}`} aria-hidden="true">{item.icon}</span><span className="settings-navigation__copy"><strong>{item.title}</strong><span>{item.description}</span></span><span className="settings-chevron" aria-hidden="true">›</span>
      </Link>)}
      {process.env.NODE_ENV === 'development' && <Link className="settings-navigation__row" href="/settings/developer"><span className="settings-navigation__icon is-developer" aria-hidden="true">⚙</span><span className="settings-navigation__copy"><strong>Developer</strong><span>Debug and development tools</span></span><span className="settings-chevron" aria-hidden="true">›</span></Link>}
    </nav>
  </main>;
}
