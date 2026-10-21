"use client";
import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { clearNavigationScroll, takeNavigationScroll } from '@/lib/navigationScroll';
import { recordSettingsHistoryPop, recordSettingsRoute } from '@/lib/settingsNavigation';
export default function NavigationScrollReset() {
  const path = usePathname();
  useLayoutEffect(() => {
    recordSettingsRoute(path);
    if (takeNavigationScroll(path) && !/^\/settings(?:\/|$)/.test(path) && !/^\/learn(?:\/[^/]+)?\/?$/.test(path)) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [path]);
  useEffect(() => {
    const onPopState = () => { recordSettingsHistoryPop(); clearNavigationScroll(); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return null;
}
