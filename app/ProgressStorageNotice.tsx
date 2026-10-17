"use client";
import Link from '@/lib/AppLink';
import { useEffect, useState } from 'react';
import { makeBackup } from '@/lib/progressStorage';
export default function ProgressStorageNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const receive = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('coptic-progress-error', receive);
    try { makeBackup(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Progress storage is unavailable.'); }
    return () => window.removeEventListener('coptic-progress-error', receive);
  }, []);
  return message ? <aside role="alert" className="ui-panel" style={{ padding: 16, margin: 16 }}>
    <p>Some saved progress could not be loaded safely. {message}</p>
    <p>Unavailable progress may be missing from this screen. Its stored copy is preserved; updates to damaged records are blocked.</p>
    <Link href="/settings/">Open Progress &amp; Backup in Settings</Link>
  </aside> : null;
}
