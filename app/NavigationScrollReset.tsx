"use client";
import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { clearNavigationScroll, takeNavigationScroll } from '@/lib/navigationScroll';
import { cancelSettingsTransition, transitionSettingsHistoryPop } from '@/lib/settingsNavigation';
export default function NavigationScrollReset() {
  const path = usePathname();
  useLayoutEffect(() => {
    if (!/^\/settings(?:\/|$)/.test(path)) cancelSettingsTransition();
    if (takeNavigationScroll(path) && !/^\/learn(?:\/[^/]+)?\/?$/.test(path)) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [path]);
  useEffect(() => {
    const onPopState = () => { transitionSettingsHistoryPop(); clearNavigationScroll(); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return null;
}
