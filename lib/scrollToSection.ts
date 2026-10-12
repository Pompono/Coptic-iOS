export function scrollToSection(element: HTMLElement | null) {
  if (!element) return;
  const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 16);
  window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
