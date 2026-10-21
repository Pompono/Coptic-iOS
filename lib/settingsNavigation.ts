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

function animateSettingsFallback(update: () => void, direction: "forward" | "back", destination?: string) {
  const source = document.querySelector<HTMLElement>(".settings-page:not([data-settings-snapshot])");
  if (!source || !destination) { update(); return; }

  const bounds = source.getBoundingClientRect();
  const snapshot = source.cloneNode(true) as HTMLElement;
  snapshot.dataset.settingsSnapshot = "true";
  snapshot.setAttribute("aria-hidden", "true");
  snapshot.inert = true;
  snapshot.style.position = "fixed";
  snapshot.style.top = `${bounds.top}px`;
  snapshot.style.left = `${bounds.left}px`;
  snapshot.style.width = `${bounds.width}px`;
  snapshot.style.margin = "0";
  snapshot.style.zIndex = "20";
  snapshot.style.pointerEvents = "none";

  const sourceControls = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
  const snapshotControls = snapshot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
  sourceControls.forEach((control, index) => {
    const copy = snapshotControls[index];
    if (control instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
      copy.value = control.value;
      copy.checked = control.checked;
    } else if (control instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) copy.value = control.value;
    else if (control instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) copy.selectedIndex = control.selectedIndex;
  });

  document.body.append(snapshot);
  const destinationPath = pathname(destination);
  let frame = 0;
  let frames = 0;
  let finished = false;
  let observedPage: HTMLElement | undefined;
  let observer: MutationObserver | undefined;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    snapshot.remove();
    if (observedPage) {
      observedPage.style.position = "";
      observedPage.style.zIndex = "";
    }
  };
  const inspectRoute = () => {
    if (finished) return;
    const nextPage = document.querySelector<HTMLElement>(".settings-page:not([data-settings-snapshot])");
    if (nextPage && nextPage !== source && pathname(window.location.pathname) === destinationPath) {
      observedPage = nextPage;
      observer?.disconnect();
      nextPage.style.position = "relative";
      nextPage.style.zIndex = "21";
      const outgoing = direction === "forward" ? "-14%" : "100%";
      const incoming = direction === "forward" ? "100%" : "-14%";
      const timing: KeyframeAnimationOptions = { duration: 280, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" };
      const oldAnimation = snapshot.animate([{ transform: "translateX(0)" }, { transform: `translateX(${outgoing})` }], timing);
      const newAnimation = nextPage.animate([{ transform: `translateX(${incoming})` }, { transform: "translateX(0)" }], timing);
      void Promise.all([oldAnimation.finished, newAnimation.finished]).then(cleanup, cleanup);
      return;
    }
    if (++frames >= 60) { cleanup(); return; }
    frame = requestAnimationFrame(inspectRoute);
  };

  observer = new MutationObserver(inspectRoute);
  observer.observe(document.body, { childList: true, subtree: true });
  try { update(); } catch (error) { cleanup(); throw error; }
  frame = requestAnimationFrame(inspectRoute);
}

/** Animate a Settings route change when the browser supports native snapshots. */
export function navigateSettings(
  update: () => void,
  direction: "forward" | "back" = "forward",
  destination?: string,
) {
  const root = document.documentElement;
  const view = document as TransitionDocument;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  if (!view.startViewTransition) {
    animateSettingsFallback(update, direction, destination);
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
    animateSettingsFallback(update, direction, destination);
  }
}
