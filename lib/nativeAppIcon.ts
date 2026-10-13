import { Capacitor, registerPlugin } from '@capacitor/core';

const AppIcon = registerPlugin<{ setTheme(options: { theme: 'light' | 'dark' }): Promise<void> }>('AppIcon');
let desired: 'light' | 'dark' | null = null;
let updating: Promise<void> | null = null;

/** Serialize changes: rapid theme taps must leave the icon at the final theme. */
export function syncNativeAppIcon(theme: 'light' | 'dark'): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') return Promise.resolve();
  desired = theme;
  if (updating) return updating;
  updating = (async () => {
    while (desired !== null) {
      const next = desired;
      desired = null;
      try { await AppIcon.setTheme({ theme: next }); }
      catch (error) {
        // Keep processing a newer choice even if an earlier request failed.
        if (desired === null) throw error;
      }
    }
  })().finally(() => { updating = null; });
  return updating;
}
