'use client';

import { useEffect } from 'react';
import { createRoutePreparation } from '@/lib/routePreparation';

const preparation = createRoutePreparation();
// Import code only. Do not mount pages, run their effects or fetch RSC segments:
// WebKit can reject speculative segment requests during document navigation.
const loaders: Record<string, () => Promise<unknown>> = {
  '/settings/': () => import('./settings/SettingsNavigationHost'),
  '/learn/': () => import('./learn/[lessonId]/UnitProgressClient'),
  '/dictionary/': () => import('./dictionary/page'),
  '/translator/': () => import('./translator/page'),
  '/': () => import('./page'),
};

export default function RoutePreparation() {
  useEffect(() => {
    let stopped = false;
    let warming = false;
    let timer = 0;
    let idle = 0;
    let frame = 0;
    const schedule = () => {
      if (stopped) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.visibilityState !== 'visible') return;
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm);
        else warm();
      }, 750);
    };
    const warm = async () => {
      if (stopped || warming || document.visibilityState !== 'visible') return;
      const route = preparation.next(window.location.pathname);
      if (!route) return;
      warming = true;
      await preparation.prepare(route, async href => {
        await loaders[href]();
        performance.mark(`coptic-route-ready:${href}`);
      });
      warming = false;
      schedule();
    };
    const visibility = () => {
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      if (document.visibilityState === 'visible' && !warming) schedule();
    };
    // Two frames allow the initial useful screen to paint before scheduling work.
    frame = requestAnimationFrame(() => { frame = requestAnimationFrame(schedule); });
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return null;
}
