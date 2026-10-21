"use client";

type ViewTransitionHandle = { finished: Promise<void>; skipTransition?: () => void };
type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionHandle;
};

let activeTransition: ViewTransitionHandle | undefined;
const settingsHistory: string[] = [];
const pathname = (href: string) => new URL(href, window.location.href).pathname.replace(/\/$/, '') || '/';

export function rememberSettingsPush(href: string) {
  if (pathname(href) !== pathname(window.location.pathname)) settingsHistory.push(pathname(window.location.pathname));
}

export function consumeSettingsBack(href: string) {
  if (settingsHistory.at(-1) !== pathname(href)) return false;
  settingsHistory.pop();
  return true;
}

/** Animate a Settings route change when the browser supports native snapshots. */
export function navigateSettings(
  update: () => void,
  direction: "forward" | "back" = "forward",
  destination?: string,
) {
  const root = document.documentElement;
  const view = document as TransitionDocument;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !view.startViewTransition) {
    update();
    return;
  }

  activeTransition?.skipTransition?.();
  root.dataset.settingsNavigation = direction;
  try {
    const transition = view.startViewTransition(() => {
      update();
      if (!destination || pathname(destination) === pathname(window.location.pathname)) return;
      return new Promise<void>(resolve => {
        let frames = 0;
        const waitForRoute = () => {
          if (pathname(destination) === pathname(window.location.pathname)) {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          } else if (++frames >= 60) resolve();
          else requestAnimationFrame(waitForRoute);
        };
        waitForRoute();
      });
    });
    activeTransition = transition;
    void transition.finished.catch(() => undefined).finally(() => {
      if (activeTransition === transition) {
        activeTransition = undefined;
        delete root.dataset.settingsNavigation;
      }
    });
  } catch {
    delete root.dataset.settingsNavigation;
    update();
  }
}
