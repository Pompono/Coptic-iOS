// A fixed budget, not a crawl of the lesson catalogue or visible links.
export const MAIN_ROUTES = ['/settings/', '/learn/', '/dictionary/', '/translator/', '/'] as const;

export function createRoutePreparation() {
  const attempted = new Set<string>();
  return {
    next(current: string) {
      attempted.add(current.replace(/\/$/, '') || '/');
      return MAIN_ROUTES.find(route => !attempted.has(route.replace(/\/$/, '') || '/'));
    },
    prepare(route: string, prefetch: (href: string) => void) {
      const key = route.replace(/\/$/, '') || '/';
      if (attempted.has(key)) return;
      attempted.add(key);
      // Failure is opportunistic: normal navigation remains responsible for retry.
      try { prefetch(route); } catch { /* Never block the visible page. */ }
    },
  };
}
