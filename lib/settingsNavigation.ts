"use client";

type SettingsDelegate = { navigate: (href: string, direction: 'forward' | 'back') => void; leave: () => void };
let delegate: SettingsDelegate | undefined;
export function registerSettingsNavigation(value: SettingsDelegate) {
  delegate = value;
  return () => { if (delegate === value) delegate = undefined; };
}
/** Only a mounted Settings host may handle these requests. */
export function requestSettingsNavigation(href: string, direction: 'forward' | 'back' = 'forward') {
  if (!delegate || !isSettingsPath(pathname(window.location.pathname))) return false;
  delegate.navigate(href, direction);
  return true;
}

const settingsHistory: string[] = [];
let activeSettingsPath: string | undefined;
let pendingSettingsPath: string | undefined;

const pathname = (href: string) => new URL(href, window.location.href).pathname.replace(/\/$/, '') || '/';
const isSettingsPath = (path: string) => path === '/settings' || path.startsWith('/settings/');

/** Track Settings entries so an in-app Back link can use browser history when it is safe. */
export function rememberSettingsPush(href: string) {
  pendingSettingsPath = pathname(href);
}

/** Commit history bookkeeping only after App Router reports the rendered route. */
export function recordSettingsRoute(path: string) {
  const destination = pathname(path);
  const source = activeSettingsPath;
  if (!isSettingsPath(destination)) {
    leaveSettingsNavigation();
    return;
  }
  if (!source) {
    activeSettingsPath = destination;
    pendingSettingsPath = undefined;
    return;
  }
  if (source !== destination && pendingSettingsPath === destination) settingsHistory.push(source);
  activeSettingsPath = destination;
  pendingSettingsPath = undefined;
}

export function consumeSettingsBack(href: string) {
  const destination = pathname(href);
  if (settingsHistory.at(-1) !== destination) return false;
  settingsHistory.pop();
  activeSettingsPath = destination;
  return true;
}

/** Keep the Settings history hint aligned with browser and system Back/Forward. */
export function recordSettingsHistoryPop() {
  const destination = pathname(window.location.pathname);
  const source = activeSettingsPath;
  pendingSettingsPath = undefined;

  if (!source || source === destination) {
    activeSettingsPath = isSettingsPath(destination) ? destination : undefined;
    if (!isSettingsPath(destination)) settingsHistory.length = 0;
    return;
  }

  if (!isSettingsPath(source) || !isSettingsPath(destination)) {
    settingsHistory.length = 0;
    activeSettingsPath = isSettingsPath(destination) ? destination : undefined;
    return;
  }

  if (settingsHistory.at(-1) === destination) settingsHistory.pop();
  else settingsHistory.push(source);
  activeSettingsPath = destination;
}

/** Clear the in-app hint when navigation leaves Settings through a tab or link. */
export function leaveSettingsNavigation() {
  delegate?.leave();
  settingsHistory.length = 0;
  activeSettingsPath = undefined;
  pendingSettingsPath = undefined;
}

/**
 * Stable direct App Router fallback for callers outside the persistent host.
 */
export function navigateSettings(update: () => void) {
  update();
}
