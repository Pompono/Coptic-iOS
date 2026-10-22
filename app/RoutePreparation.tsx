'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createRoutePreparation } from '@/lib/routePreparation';

const preparation = createRoutePreparation();

export default function RoutePreparation() {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let idle = 0;
    let frame = 0;
    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => {
        if (document.visibilityState !== 'visible') return;
        if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm);
        else warm();
      }, 750);
    };
    const warm = () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const route = preparation.next(window.location.pathname);
      if (!route) return;
      preparation.prepare(route, href => router.prefetch(href));
      schedule();
    };
    const visibility = () => {
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      if (document.visibilityState === 'visible') schedule();
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
  }, [router]);
  return null;
}
