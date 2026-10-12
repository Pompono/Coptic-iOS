let pending: string | null = null;
const normalize = (path: string) => path.replace(/\/$/, '') || '/';
export function prepareNavigationScroll(href: string) {
  if (!href.startsWith('/') || href.includes('#')) return;
  const target = normalize(new URL(href, window.location.href).pathname);
  pending = target === normalize(window.location.pathname) ? null : target;
}
export function takeNavigationScroll(path: string) {
  if (pending !== normalize(path)) return false;
  pending = null; return true;
}
export function clearNavigationScroll() { pending = null; }
