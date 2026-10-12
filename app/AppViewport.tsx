"use client";
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
export default function AppViewport({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/$/, '');
  const exercise = /^\/learn\/[^/]+\/play\/[^/]+$/.test(path);
  return <div className="mobile-chin-page-shell" data-exercise={exercise}>{children}</div>;
}
