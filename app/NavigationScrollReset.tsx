"use client";
import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { clearNavigationScroll, takeNavigationScroll } from '@/lib/navigationScroll';
export default function NavigationScrollReset() {
  const path = usePathname();
  useLayoutEffect(() => {
    if (takeNavigationScroll(path) && !/^\/learn(?:\/[^/]+)?\/?$/.test(path)) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [path]);
  useEffect(() => {
    window.addEventListener('popstate', clearNavigationScroll);
    return () => window.removeEventListener('popstate', clearNavigationScroll);
  }, []);
  return null;
}
