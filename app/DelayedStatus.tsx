'use client';

import { useEffect, useState } from 'react';

/** Keep fast local work from flashing; long work remains honestly announced. */
export default function DelayedStatus({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <p role="status" className="text-sm text-[var(--text-muted)]">{children}</p> : null;
}
