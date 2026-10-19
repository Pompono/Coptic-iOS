'use client';

import { useAuth } from '../../AuthProvider';
import PageHeader from '../../PageHeader';

export default function PasswordRecoveryCallbackPage() {
  const { loading, error } = useAuth();
  return <main className="app-page" style={{ display: 'grid', alignContent: 'start', gap: 18 }}>
    <PageHeader title="Account" icon="settings" />
    <section className="ui-panel" style={{ padding: 20 }} aria-live="polite">
      <h1>{error ? 'Could not complete password reset' : 'Completing password reset'}</h1>
      <p role={error ? 'alert' : 'status'}>{error || (loading ? 'Please wait while this device verifies the link…' : 'Your password reset is ready. Continue in the app.')}</p>
    </section>
  </main>;
}
