"use client";

const settingsHistory: string[] = [];
let activeSettingsPath: string | undefined;
let cancelActiveSettingsTransition: (() => void) | undefined;
const pathname = (href: string) => new URL(href, window.location.href).pathname.replace(/\/$/, '') || '/';
const isSettingsPath = (path: string) => path === '/settings' || path.startsWith('/settings/');

export function rememberSettingsPush(href: string) {
  activeSettingsPath ??= pathname(window.location.pathname);
  const destination = pathname(href);
  if (destination !== activeSettingsPath) settingsHistory.push(activeSettingsPath);
  activeSettingsPath = destination;
}

export function consumeSettingsBack(href: string) {
  const destination = pathname(href);
  if (settingsHistory.at(-1) !== destination) return false;
  settingsHistory.pop();
  activeSettingsPath = destination;
  return true;
}

/** Animate browser or system history changes that bypass the Settings link handler. */
export function transitionSettingsHistoryPop() {
  cancelActiveSettingsTransition?.();
  const destination = pathname(window.location.pathname);
  const sourcePath = activeSettingsPath ?? destination;
  if (sourcePath === destination || !isSettingsPath(sourcePath) || !isSettingsPath(destination)) {
    activeSettingsPath = destination;
    return;
  }

  const direction = destination === '/settings' ? 'back' : 'forward';
  if (direction === 'back' && settingsHistory.at(-1) === destination) settingsHistory.pop();
  else if (direction === 'forward') settingsHistory.push(sourcePath);
  activeSettingsPath = destination;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const source = document.querySelector<HTMLElement>('.settings-page:not([data-settings-snapshot])');
  if (!source) return;
  animateSettingsFallback(() => undefined, direction, destination);
}

function animateSettingsFallback(update: () => void, direction: "forward" | "back", destination?: string) {
  cancelActiveSettingsTransition?.();
  const source = document.querySelector<HTMLElement>(".settings-page:not([data-settings-snapshot])");
  if (!source || !destination) { update(); return; }

  const bounds = source.getBoundingClientRect();
  const sourceTitle = source.querySelector("h1")?.textContent;
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
  const copyControlValues = (controls: NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, copies: NodeListOf<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    controls.forEach((control, index) => {
      const copy = copies[index];
      if (control instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
        copy.value = control.value;
        copy.checked = control.checked;
      } else if (control instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) copy.value = control.value;
      else if (control instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) copy.selectedIndex = control.selectedIndex;
    });
  };
  copyControlValues(sourceControls, snapshotControls);

  document.body.append(snapshot);
  const destinationPath = pathname(destination);
  let frame = 0;
  let frames = 0;
  let finished = false;
  let destinationSnapshot: HTMLElement | undefined;
  let observer: MutationObserver | undefined;
  let pageAnimations: Animation[] = [];
  const cleanup = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    pageAnimations.forEach(animation => animation.cancel());
    snapshot.remove();
    destinationSnapshot?.remove();
    if (cancelActiveSettingsTransition === cleanup) cancelActiveSettingsTransition = undefined;
  };
  cancelActiveSettingsTransition = cleanup;
  const inspectRoute = () => {
    if (finished) return;
    if (!isSettingsPath(pathname(window.location.pathname))) { cleanup(); return; }
    const nextPage = document.querySelector<HTMLElement>(".settings-page:not([data-settings-snapshot])");
    const pageContentChanged = nextPage && (
      nextPage !== source || nextPage.querySelector("h1")?.textContent !== sourceTitle
    );
    if (nextPage && pageContentChanged && pathname(window.location.pathname) === destinationPath) {
      observer?.disconnect();
      const destinationBounds = nextPage.getBoundingClientRect();
      destinationSnapshot = nextPage.cloneNode(true) as HTMLElement;
      destinationSnapshot.dataset.settingsSnapshot = "true";
      destinationSnapshot.setAttribute("aria-hidden", "true");
      destinationSnapshot.inert = true;
      destinationSnapshot.style.position = "fixed";
      destinationSnapshot.style.top = `${destinationBounds.top}px`;
      destinationSnapshot.style.left = `${destinationBounds.left}px`;
      destinationSnapshot.style.width = `${destinationBounds.width}px`;
      destinationSnapshot.style.margin = "0";
      destinationSnapshot.style.zIndex = "21";
      destinationSnapshot.style.pointerEvents = "none";
      copyControlValues(
        nextPage.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"),
        destinationSnapshot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"),
      );
      document.body.append(destinationSnapshot);
      const outgoing = direction === "forward" ? "-14%" : "100%";
      const incoming = direction === "forward" ? "100%" : "-14%";
      const timing: KeyframeAnimationOptions = { duration: 280, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" };
      try {
        const oldAnimation = snapshot.animate([{ transform: "translateX(0)" }, { transform: `translateX(${outgoing})` }], timing);
        pageAnimations.push(oldAnimation);
        const newAnimation = destinationSnapshot.animate([{ transform: `translateX(${incoming})` }, { transform: "translateX(0)" }], timing);
        pageAnimations.push(newAnimation);
        void Promise.all([oldAnimation.finished, newAnimation.finished]).then(cleanup, cleanup);
      } catch {
        cleanup();
      }
      return;
    }
    // Keep the outgoing page visible while Next.js loads a route chunk. Slow
    // WebViews can take longer than one second before the incoming page mounts.
    if (++frames >= 300) { cleanup(); return; }
    frame = requestAnimationFrame(inspectRoute);
  };

  observer = new MutationObserver(inspectRoute);
  observer.observe(document.body, { childList: true, subtree: true });
  try { update(); } catch (error) { cleanup(); throw error; }
  frame = requestAnimationFrame(inspectRoute);
}

/** Animate a Settings route change without delaying the router update. */
export function navigateSettings(
  update: () => void,
  direction: "forward" | "back" = "forward",
  destination?: string,
) {
  cancelActiveSettingsTransition?.();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  animateSettingsFallback(update, direction, destination);
}

/** Remove transition overlays immediately if another route or gesture takes over. */
export function cancelSettingsTransition() {
  cancelActiveSettingsTransition?.();
}
